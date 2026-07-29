import React from 'react';
import {AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame, useVideoConfig} from 'remotion';
import {createRouletteLayout, getSpinStartRotation, positiveModulo} from '../../rouletteLayout';
import {getVideoTiming} from '../../videoTiming';
import {base, palette} from '../styles';

const WHEEL_SIZE = 940;
const WHEEL_CENTER = WHEEL_SIZE / 2;
const LABEL_INNER_RADIUS = 185;
const LABEL_OUTER_RADIUS = 405;
const HUB_RADIUS = 108;
const DIVIDER_OUTER_RADIUS = 443;
const SPIN_EASING = Easing.bezier(0.08, 0.62, 0.12, 1);

const getWheelRotation = (frame, stopFrame, finalRotation) => interpolate(frame, [0, stopFrame], [getSpinStartRotation(finalRotation), finalRotation], {
  easing: SPIN_EASING,
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});

export const Roulette = ({brands, eliminatedBrand, durationSeconds, day}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {rouletteEndFrame, rouletteStopFrame} = getVideoTiming(durationSeconds, fps);
  const opacity = interpolate(frame, [rouletteEndFrame - 8, rouletteEndFrame], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const {labels, eliminatedIndex, segmentAngle, finalRotation} = createRouletteLayout(brands, eliminatedBrand, day);
  const rotation = getWheelRotation(frame, rouletteStopFrame, finalRotation);
  const previousRotation = getWheelRotation(Math.max(0, frame - 1), rouletteStopFrame, finalRotation);
  const labelRadius = (LABEL_INNER_RADIUS + LABEL_OUTER_RADIUS) / 2;
  const labelWidth = LABEL_OUTER_RADIUS - LABEL_INNER_RADIUS;
  const fontSize = labels.length > 48 ? 15 : labels.length > 36 ? 18 : labels.length > 24 ? 21 : labels.length > 16 ? 25 : 30;

  // The color only starts changing once the rotation has reached its final value.
  const highlightProgress = interpolate(frame, [rouletteStopFrame, rouletteStopFrame + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eliminatedColor = interpolateColors(highlightProgress, [0, 1], [palette.text, palette.secondary]);

  // The pointer loads up as a divider approaches, snaps past it and rebounds.
  // Keeping some strength at low speed makes the final ticks remain perceptible.
  const tickPhase = positiveModulo(rotation + segmentAngle / 2, segmentAngle) / segmentAngle;
  const tickShape = interpolate(
    tickPhase,
    [0, 0.08, 0.18, 0.32, 0.52, 0.7, 1],
    [15, -7, 4, -2, 0, 0, -18],
  );
  const degreesPerFrame = Math.abs(rotation - previousRotation);
  const tickStrength = interpolate(degreesPerFrame, [0, segmentAngle * 0.08, segmentAngle * 0.6, segmentAngle * 1.4], [0.5, 0.72, 1, 1.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pointerDeflection = frame < rouletteStopFrame ? tickShape * tickStrength : 0;
  const contactLoad = tickPhase >= 0.7
    ? interpolate(tickPhase, [0.7, 1], [0, 1])
    : interpolate(tickPhase, [0, 0.14], [0.65, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pointerCompression = frame < rouletteStopFrame ? contactLoad * tickStrength : 0;

  return (
    <AbsoluteFill style={{...base, alignItems: 'center', justifyContent: 'center', opacity}}>
      <div
        style={{
          position: 'absolute',
          top: 470,
          zIndex: 4,
          width: 0,
          height: 0,
          borderLeft: '42px solid transparent',
          borderRight: '42px solid transparent',
          borderTop: `85px solid ${palette.secondary}`,
          filter: 'drop-shadow(0 8px 8px #0008)',
          transform: `rotate(${pointerDeflection}deg) translateY(${-2.5 * pointerCompression}px) scaleY(${1 - 0.035 * pointerCompression})`,
          transformOrigin: '50% 6px',
          willChange: 'transform',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: WHEEL_SIZE,
          height: WHEEL_SIZE,
          flex: `0 0 ${WHEEL_SIZE}px`,
          borderRadius: '50%',
          overflow: 'hidden',
          background: `radial-gradient(circle at center, #1d2134 0%, ${palette.panel} 70%)`,
          boxShadow: `inset 0 0 0 18px ${palette.primary}, inset 0 0 42px #0009, 0 0 90px #ff3d6e55`,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${WHEEL_CENTER}px ${WHEEL_CENTER}px`,
          willChange: 'transform',
        }}
      >
        {labels.map((_, index) => {
          const boundaryAngle = (index - 0.5) * segmentAngle - 90;
          const rad = (boundaryAngle * Math.PI) / 180;
          return (
            <div
              key={`divider-${index}`}
              style={{
                position: 'absolute',
                zIndex: 1,
                left: WHEEL_CENTER + Math.cos(rad) * HUB_RADIUS,
                top: WHEEL_CENTER + Math.sin(rad) * HUB_RADIUS,
                width: DIVIDER_OUTER_RADIUS - HUB_RADIUS,
                height: 1,
                marginTop: -0.5,
                background: 'linear-gradient(90deg, #d4b8c940, #e9dce45c)',
                boxShadow: '0 0 2px #ff9ab022',
                transform: `rotate(${boundaryAngle}deg)`,
                transformOrigin: '0 50%',
              }}
            />
          );
        })}
        {labels.map((brand, index) => {
          const angle = index * segmentAngle - 90;
          const rad = (angle * Math.PI) / 180;
          const normalizedAngle = positiveModulo(angle, 360);
          const isLeftSide = normalizedAngle > 90 && normalizedAngle < 270;
          const readableAngle = isLeftSide ? angle + 180 : angle;
          const isEliminated = index === eliminatedIndex;
          return (
            <div
              key={brand}
              style={{
                position: 'absolute',
                zIndex: 2,
                left: WHEEL_CENTER + Math.cos(rad) * labelRadius,
                top: WHEEL_CENTER + Math.sin(rad) * labelRadius,
                width: labelWidth,
                marginLeft: -labelWidth / 2,
                marginTop: -fontSize / 2,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                textAlign: 'center',
                transformOrigin: '50% 50%',
                fontWeight: 800,
                fontSize,
                transform: `rotate(${readableAngle}deg)`,
                color: isEliminated ? eliminatedColor : palette.text,
                textShadow: isEliminated && highlightProgress > 0 ? `0 0 ${12 * highlightProgress}px #ffca3aaa, 0 2px 5px #000` : '0 2px 5px #000',
              }}
            >
              {brand}
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            zIndex: 3,
            left: WHEEL_CENTER - HUB_RADIUS,
            top: WHEEL_CENTER - HUB_RADIUS,
            width: HUB_RADIUS * 2,
            height: HUB_RADIUS * 2,
            boxSizing: 'border-box',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 32%, #493044 0%, #271c31 38%, #111522 100%)',
            border: '3px solid #ff7c9b70',
            boxShadow: 'inset 0 0 24px #0009, 0 0 24px #ff3d6e38',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
