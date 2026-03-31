'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function CustomCursor() {
  const [visible, setVisible] = useState(false)
  const [clicking, setClicking] = useState(false)
  const [hovering, setHovering] = useState(false)

  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)

  // Dot follows instantly
  const dotX = useSpring(mouseX, { stiffness: 2000, damping: 80 })
  const dotY = useSpring(mouseY, { stiffness: 2000, damping: 80 })

  // Ring follows with lag (the trailing halo)
  const ringX = useSpring(mouseX, { stiffness: 180, damping: 22 })
  const ringY = useSpring(mouseY, { stiffness: 180, damping: 22 })

  // Faint outer trail — even lazier
  const trailX = useSpring(mouseX, { stiffness: 90, damping: 18 })
  const trailY = useSpring(mouseY, { stiffness: 90, damping: 18 })

  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
      if (!visible) setVisible(true)
    }
    function onLeave() { setVisible(false) }
    function onEnter() { setVisible(true) }
    function onDown() { setClicking(true) }
    function onUp() { setClicking(false) }

    function onHoverStart(e: MouseEvent) {
      const el = e.target as HTMLElement
      if (
        el.tagName === 'A' ||
        el.tagName === 'BUTTON' ||
        el.closest('a') ||
        el.closest('button') ||
        el.getAttribute('role') === 'button' ||
        el.style.cursor === 'pointer' ||
        window.getComputedStyle(el).cursor === 'pointer'
      ) {
        setHovering(true)
      } else {
        setHovering(false)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousemove', onHoverStart)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('mouseenter', onEnter)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousemove', onHoverStart)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('mouseenter', onEnter)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
    }
  }, [mouseX, mouseY, visible])

  // Only render on non-touch devices
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])
  if (isTouch) return null

  return (
    <>
      {/* Faint outer trail */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          x: trailX,
          y: trailY,
          translateX: '-50%',
          translateY: '-50%',
          opacity: visible ? 1 : 0,
        }}
      >
        <motion.div
          animate={{
            width: hovering ? 56 : clicking ? 28 : 40,
            height: hovering ? 56 : clicking ? 28 : 40,
            opacity: hovering ? 0.08 : 0.05,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,1) 0%, transparent 70%)',
          }}
        />
      </motion.div>

      {/* Mid ring */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          opacity: visible ? 1 : 0,
        }}
      >
        <motion.div
          animate={{
            width: hovering ? 38 : clicking ? 18 : 26,
            height: hovering ? 38 : clicking ? 18 : 26,
            borderColor: hovering ? 'rgba(167,139,250,0.7)' : 'rgba(124,58,237,0.45)',
            scale: clicking ? 0.85 : 1,
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          style={{
            borderRadius: '50%',
            border: '1.5px solid rgba(124,58,237,0.45)',
          }}
        />
      </motion.div>

      {/* Sharp center dot */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          x: dotX,
          y: dotY,
          translateX: '-50%',
          translateY: '-50%',
          opacity: visible ? 1 : 0,
        }}
      >
        <motion.div
          animate={{
            width: hovering ? 6 : clicking ? 3 : 5,
            height: hovering ? 6 : clicking ? 3 : 5,
            background: hovering ? '#A78BFA' : '#7C3AED',
            scale: clicking ? 0.6 : 1,
          }}
          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          style={{ borderRadius: '50%' }}
        />
      </motion.div>
    </>
  )
}
