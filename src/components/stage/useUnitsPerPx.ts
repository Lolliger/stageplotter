import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * SVG-Einheiten pro CSS-Pixel. Damit bleiben Knoten, Schrift und Trefferflächen auf dem
 * Bildschirm gleich groß, egal wie groß die Bühne ist oder wie breit das Display.
 */
export function useUnitsPerPx(
  svgRef: RefObject<SVGSVGElement | null>,
  viewWidth: number,
  viewHeight: number,
): { unitsPerPx: number; widthPx: number } {
  const [value, setValue] = useState({ unitsPerPx: 1, widthPx: 375 })

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = () => {
      const { width, height } = svg.getBoundingClientRect()
      if (width === 0 || height === 0) return
      // preserveAspectRatio="meet": die engere Achse bestimmt den Maßstab.
      setValue({ unitsPerPx: Math.max(viewWidth / width, viewHeight / height), widthPx: width })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [svgRef, viewWidth, viewHeight])

  return value
}
