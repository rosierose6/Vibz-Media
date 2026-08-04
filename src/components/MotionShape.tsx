import React from "react";
import type { AnimatedShape, ShapeProps } from "../integrations/motion-graphics";

function renderPrimitive(type: AnimatedShape["type"], props: ShapeProps) {
  const fill = props.fill ?? "#F2C94C";
  const stroke = props.stroke ?? "none";
  const strokeWidth = props.strokeWidth ?? 0;
  const opacity = props.opacity ?? 1;
  const scale = props.scale ?? 1;
  const rotation = props.rotation ?? 0;
  const x = props.x ?? 0;
  const y = props.y ?? 0;

  const transform = `translate(${x}, ${y}) rotate(${rotation}) scale(${scale})`;

  if (type === "rect") {
    const w = props.width ?? 100;
    const h = props.height ?? 40;
    return (
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        transform={transform}
      />
    );
  }

  if (type === "star") {
    const r = props.radius ?? 40;
    const points = props.points ?? 5;
    const coords: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? r : r * 0.45;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      coords.push(`${Math.cos(angle) * radius},${Math.sin(angle) * radius}`);
    }
    return (
      <polygon
        points={coords.join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        transform={transform}
      />
    );
  }

  const r = props.radius ?? 24;
  return (
    <circle
      cx={0}
      cy={0}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      transform={transform}
    />
  );
}

export const MotionShape: React.FC<{
  shape: AnimatedShape;
  frame: number;
}> = ({ shape, frame }) => {
  const props = shape.getPropsAtFrame(frame);
  return <>{renderPrimitive(shape.type, props)}</>;
};
