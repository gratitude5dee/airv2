// Harvested components import plain `.module.css` files; the bundle resolves
// them to a classes map at app build time.
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
