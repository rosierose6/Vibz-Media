/**
 * VIBZ MEDIA — Vector Graphics Integration
 *
 * Programmatic SVG creation for Remotion (inline or file export).
 *
 * Usage:
 *   import { createSVG, addCircle, addText, addLinearGradient, exportSVG } from "./integrations/vector-graphics";
 *
 *   let doc = createSVG(1920, 1080);
 *   doc = addLinearGradient(doc, "bg", [
 *     { offset: "0%", color: "#0a0a0a" },
 *     { offset: "100%", color: "#1a1a2e" },
 *   ], 135);
 *   doc = addCircle(doc, { cx: 960, cy: 540, r: 200, fill: "url(#bg)", stroke: "#FFD700", strokeWidth: 2 });
 *   doc = addText(doc, { content: "Vibz Media", x: 960, y: 560, fontSize: 72, fontWeight: 100, fill: "#FFFFFF" });
 *
 *   const svg = exportSVG(doc);
 *   // Use in Remotion: <div dangerouslySetInnerHTML={{ __html: svg }} />
 *
 * Repos:
 *   - https://github.com/svgdotjs/svg.js
 *   - https://github.com/SVG-Edit/svgedit
 *   - https://github.com/paperjs/paper.js
 */

export interface SVGDocument {
  width: number;
  height: number;
  viewBox: string;
  elements: SVGElementNode[];
  defs: SVGDef[];
}

export interface SVGElementNode {
  id: string;
  type:
    | "circle"
    | "rect"
    | "ellipse"
    | "line"
    | "polyline"
    | "polygon"
    | "path"
    | "text"
    | "group"
    | "image";
  attributes: Record<string, string | number>;
  content?: string;
  children?: SVGElementNode[];
  transform?: string;
}

export interface SVGDef {
  type:
    | "linearGradient"
    | "radialGradient"
    | "filter"
    | "clipPath"
    | "mask"
    | "pattern";
  id: string;
  attributes: Record<string, string | number>;
  stops?: { offset: string; color: string; opacity?: number }[];
}

export interface CircleProps {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface RectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface PathProps {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  opacity?: number;
  fillRule?: "nonzero" | "evenodd";
}

export interface TextProps {
  content: string;
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  fill?: string;
  textAnchor?: "start" | "middle" | "end";
  letterSpacing?: string;
  opacity?: number;
}

let idCounter = 0;
function generateId(prefix = "el"): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function createSVG(width: number, height: number): SVGDocument {
  return {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    elements: [],
    defs: [],
  };
}

export function addCircle(doc: SVGDocument, props: CircleProps): SVGDocument {
  return {
    ...doc,
    elements: [
      ...doc.elements,
      {
        id: generateId("circle"),
        type: "circle",
        attributes: {
          cx: props.cx,
          cy: props.cy,
          r: props.r,
          fill: props.fill ?? "none",
          stroke: props.stroke ?? "none",
          "stroke-width": props.strokeWidth ?? 0,
          opacity: props.opacity ?? 1,
        },
      },
    ],
  };
}

export function addRect(doc: SVGDocument, props: RectProps): SVGDocument {
  return {
    ...doc,
    elements: [
      ...doc.elements,
      {
        id: generateId("rect"),
        type: "rect",
        attributes: {
          x: props.x,
          y: props.y,
          width: props.width,
          height: props.height,
          rx: props.rx ?? 0,
          ry: props.ry ?? 0,
          fill: props.fill ?? "none",
          stroke: props.stroke ?? "none",
          "stroke-width": props.strokeWidth ?? 0,
          opacity: props.opacity ?? 1,
        },
      },
    ],
  };
}

export function addPath(doc: SVGDocument, props: PathProps): SVGDocument {
  return {
    ...doc,
    elements: [
      ...doc.elements,
      {
        id: generateId("path"),
        type: "path",
        attributes: {
          d: props.d,
          fill: props.fill ?? "none",
          stroke: props.stroke ?? "none",
          "stroke-width": props.strokeWidth ?? 0,
          "stroke-linecap": props.strokeLinecap ?? "round",
          "stroke-linejoin": props.strokeLinejoin ?? "round",
          opacity: props.opacity ?? 1,
          ...(props.fillRule ? { "fill-rule": props.fillRule } : {}),
        },
      },
    ],
  };
}

export function addText(doc: SVGDocument, props: TextProps): SVGDocument {
  return {
    ...doc,
    elements: [
      ...doc.elements,
      {
        id: generateId("text"),
        type: "text",
        content: props.content,
        attributes: {
          x: props.x,
          y: props.y,
          "font-size": props.fontSize ?? 16,
          "font-family":
            props.fontFamily ?? '"Helvetica Neue", Helvetica, Arial, sans-serif',
          "font-weight": props.fontWeight ?? 400,
          fill: props.fill ?? "#FFFFFF",
          "text-anchor": props.textAnchor ?? "middle",
          "letter-spacing": props.letterSpacing ?? "0",
          opacity: props.opacity ?? 1,
        },
      },
    ],
  };
}

export function addLinearGradient(
  doc: SVGDocument,
  id: string,
  stops: { offset: string; color: string; opacity?: number }[],
  angle: number = 0,
): SVGDocument {
  const rad = (angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(rad) * 50;
  const y1 = 50 - Math.sin(rad) * 50;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;

  return {
    ...doc,
    defs: [
      ...doc.defs,
      {
        type: "linearGradient",
        id,
        attributes: {
          x1: `${x1}%`,
          y1: `${y1}%`,
          x2: `${x2}%`,
          y2: `${y2}%`,
        },
        stops,
      },
    ],
  };
}

export function addRadialGradient(
  doc: SVGDocument,
  id: string,
  stops: { offset: string; color: string; opacity?: number }[],
  cx = "50%",
  cy = "50%",
  r = "50%",
): SVGDocument {
  return {
    ...doc,
    defs: [
      ...doc.defs,
      {
        type: "radialGradient",
        id,
        attributes: { cx, cy, r },
        stops,
      },
    ],
  };
}

export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

/** Placeholder for paper.js-backed boolean ops. */
export function booleanOperation(
  pathA: string,
  _pathB: string,
  _operation: BooleanOp,
): string {
  return pathA;
}

function attrsToString(attributes: Record<string, string | number>): string {
  return Object.entries(attributes)
    .map(([k, v]) => `${k}="${escapeXml(String(v))}"`)
    .join(" ");
}

export function exportSVG(doc: SVGDocument): string {
  const defs =
    doc.defs.length > 0
      ? `<defs>${doc.defs
          .map((def) => {
            const stops =
              def.stops
                ?.map(
                  (s) =>
                    `<stop offset="${escapeXml(s.offset)}" stop-color="${escapeXml(s.color)}" stop-opacity="${s.opacity ?? 1}" />`,
                )
                .join("") ?? "";
            return `<${def.type} id="${escapeXml(def.id)}" ${attrsToString(def.attributes)}>${stops}</${def.type}>`;
          })
          .join("")}</defs>`
      : "";

  const elements = doc.elements
    .map((el) => {
      const attrs = attrsToString(el.attributes);
      const transform = el.transform
        ? ` transform="${escapeXml(el.transform)}"`
        : "";

      if (el.type === "text" && el.content !== undefined) {
        return `<text ${attrs}${transform}>${escapeXml(el.content)}</text>`;
      }
      return `<${el.type} ${attrs}${transform} />`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="${doc.viewBox}">
  ${defs}
  ${elements}
</svg>`;
}

/** Build the Vibz Media brand mark SVG. */
export function createVibzMark(): { doc: SVGDocument; svg: string } {
  let doc = createSVG(1920, 1080);
  doc = addLinearGradient(
    doc,
    "bg",
    [
      { offset: "0%", color: "#0a0a0a" },
      { offset: "100%", color: "#1a1a2e" },
    ],
    135,
  );
  doc = addCircle(doc, {
    cx: 960,
    cy: 540,
    r: 200,
    fill: "url(#bg)",
    stroke: "#FFD700",
    strokeWidth: 2,
  });
  doc = addText(doc, {
    content: "Vibz Media",
    x: 960,
    y: 560,
    fontSize: 72,
    fontWeight: 100,
    fill: "#FFFFFF",
  });
  return { doc, svg: exportSVG(doc) };
}
