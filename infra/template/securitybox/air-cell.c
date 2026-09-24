/* air-cell — setuid launcher that drops the caller into the agent cell.
 *
 * Runs setuid-root: unshares a mount+IPC namespace while still privileged
 * (no unprivileged-userns dependency — works under Ubuntu's AppArmor userns
 * restriction), mounts tmpfs over /tmp and every directory in
 * /etc/aircell/mask.list, ro-binds /dev/null over masked files, then drops
 * to real uid `airagent` and execs the caller's argv.
 *
 *   callers must be real uid 1000 (the platform/agent uid)
 *   inside the cell: PR_SET_NO_NEW_PRIVS, no sudo rights for airagent,
 *   masked paths read /etc/aircell/mask.list (dirs end with '/').
 *
 * Build: gcc -O2 -o air-cell air-cell.c
 */
#define _GNU_SOURCE
#include <errno.h>
#include <grp.h>
#include <pwd.h>
#include <sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mount.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#define MASK_FILE "/etc/aircell/mask.list"
#define MAX_MASKS 128

static void die(const char *m) { perror(m); _exit(127); }

int main(int argc, char **argv) {
    if (getuid() != 1000) {
        fprintf(stderr, "air-cell: only uid 1000 may enter the cell\n");
        return 126;
    }
    if (argc < 2 || (argc == 2 && !strcmp(argv[1], "--"))) {
        fprintf(stderr, "air-cell: missing command\n");
        return 126;
    }
    struct passwd *pw = getpwnam("airagent");
    if (!pw) die("air-cell: airagent user missing");

    /* Namespace work while we still hold root. */
    if (unshare(CLONE_NEWNS | CLONE_NEWIPC | CLONE_NEWUTS) != 0)
        die("air-cell: unshare");
    if (mount(NULL, "/", NULL, MS_REC | MS_PRIVATE, NULL) != 0)
        die("air-cell: make / private");

    if (mount("tmpfs", "/tmp", "tmpfs", 0, "mode=1777") != 0)
        die("air-cell: tmpfs /tmp");

    FILE *f = fopen(MASK_FILE, "r");
    if (f) {
        char line[1024];
        int m = 0;
        while (m < MAX_MASKS && fgets(line, sizeof line, f)) {
            line[strcspn(line, "\n")] = 0;
            if (!line[0] || line[0] == '#') continue;
            int isdir = 0;
            size_t L = strlen(line);
            if (L > 1 && line[L - 1] == '/') { isdir = 1; line[L - 1] = 0; }
            struct stat st;
            if (stat(line, &st) != 0) continue;   /* skip absent paths */
            if (isdir) {
                if (mount("tmpfs", line, "tmpfs", 0, "mode=0700") != 0)
                    fprintf(stderr, "air-cell: mask %s: %s\n", line, strerror(errno));
            } else {
                if (mount("/dev/null", line, NULL, MS_BIND, NULL) == 0)
                    mount(NULL, line, NULL, MS_REMOUNT | MS_BIND | MS_RDONLY, NULL);
                else
                    fprintf(stderr, "air-cell: mask %s: %s\n", line, strerror(errno));
            }
            m++;
        }
        fclose(f);
    }

    setenv("HOME", "/home/user", 1);
    setenv("AIR_CELL", "1", 1);
    setenv("USER", "airagent", 1);
    setenv("LOGNAME", "airagent", 1);

    /* Drop to airagent for real (initgroups picks up its airv membership),
     * then seal: no new privileges ever. */
    if (initgroups("airagent", pw->pw_gid) != 0) die("initgroups");
    if (setresgid(pw->pw_gid, pw->pw_gid, pw->pw_gid) != 0) die("setresgid");
    if (setresuid(pw->pw_uid, pw->pw_uid, pw->pw_uid) != 0) die("setresuid");
    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) die("no_new_privs");

    int argi = 1;
    if (argc > 1 && strcmp(argv[1], "--") == 0) argi = 2;
    execvp(argv[argi], &argv[argi]);
    die("execvp");
    return 127;
}
