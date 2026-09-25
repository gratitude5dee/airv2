"use client"

import { useState } from "react"

function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number, options?: { leading?: boolean; trailing?: boolean }) {
  const { leading = false, trailing = true } = options ?? {}
  let t: ReturnType<typeof setTimeout> | undefined
  let firedLeading = false
  return (...args: A) => {
    const burstStart = t === undefined
    if (t) clearTimeout(t)
    if (leading && burstStart) {
      firedLeading = true
      fn(...args)
    } else {
      firedLeading = false
    }
    t = setTimeout(() => {
      t = undefined
      if (trailing && !firedLeading) fn(...args)
      firedLeading = false
    }, wait)
  }
}
import { AnimationOptions, motion, stagger, useAnimate } from "motion/react"

interface TextProps {
  label: string
  reverse?: boolean
  transition?: AnimationOptions
  staggerDuration?: number
  staggerFrom?: "first" | "last" | "center" | number
  className?: string
  onClick?: () => void
}

const LetterSwapPingPong = ({
  label,
  reverse = true,
  transition = {
    type: "spring",
    duration: 0.7,
  },
  staggerDuration = 0.03,
  staggerFrom = "first",
  className,
  onClick,
  ...props
}: TextProps) => {
  const [scope, animate] = useAnimate()
  const [isHovered, setIsHovered] = useState(false)

  const mergeTransition = (baseTransition: AnimationOptions) => ({
    ...baseTransition,
    delay: stagger(staggerDuration, {
      from: staggerFrom,
    }),
  })

  const hoverStart = debounce(
    () => {
      if (isHovered) return
      setIsHovered(true)

      animate(
        ".letter",
        { y: reverse ? "100%" : "-100%" },
        mergeTransition(transition)
      )

      animate(
        ".letter-secondary",
        {
          top: "0%",
        },
        mergeTransition(transition)
      )
    },
    100,
    { leading: true, trailing: true }
  )

  const hoverEnd = debounce(
    () => {
      setIsHovered(false)

      animate(
        ".letter",
        {
          y: 0,
        },
        mergeTransition(transition)
      )

      animate(
        ".letter-secondary",
        {
          top: reverse ? "-100%" : "100%",
        },
        mergeTransition(transition)
      )
    },
    100,
    { leading: true, trailing: true }
  )

  return (
    <motion.span
      className={`flex justify-center items-center relative overflow-hidden  ${className} `}
      onHoverStart={hoverStart}
      onHoverEnd={hoverEnd}
      onClick={onClick}
      ref={scope}
      {...props}
    >
      <span className="sr-only">{label}</span>

      {label.split("").map((letter: string, i: number) => {
        return (
          <span
            className="whitespace-pre relative flex"
            key={i}
            aria-hidden={true}
          >
            <motion.span className={`relative letter`} style={{ top: 0 }}>
              {letter}
            </motion.span>
            <motion.span
              className="absolute letter-secondary "
              style={{ top: reverse ? "-100%" : "100%" }}
            >
              {letter}
            </motion.span>
          </span>
        )
      })}
    </motion.span>
  )
}

export default LetterSwapPingPong
