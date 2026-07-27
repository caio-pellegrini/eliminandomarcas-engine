import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {base, palette} from '../styles';

export const Roulette = ({brands, eliminatedBrand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const start = 1.55 * fps;
  const end = 5.25 * fps;
  const opacity = interpolate(frame, [start, start + 8, end - 6, end], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const rotation = interpolate(frame, [start, end - 10], [-1440, 0], {
    easing: Easing.bezier(0.12, 0.68, 0.18, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const alternatives = brands.filter((brand) => brand !== eliminatedBrand);
  const labels = [eliminatedBrand, ...alternatives];
  const center = 470;
  const innerRadius = 185;
  const outerRadius = 405;
  const labelRadius = (innerRadius + outerRadius) / 2;
  const labelWidth = outerRadius - innerRadius;
  const fontSize = labels.length > 48 ? 15 : labels.length > 36 ? 18 : labels.length > 24 ? 21 : labels.length > 16 ? 25 : 30;

  return (
    <AbsoluteFill style={{...base, alignItems: 'center', justifyContent: 'center', opacity}}>
      <div style={{position: 'absolute', top: 210, fontSize: 52, fontWeight: 800}}>A MARCA DE HOJE É...</div>
      <div style={{position: 'absolute', top: 415, zIndex: 3, width: 0, height: 0, borderLeft: '42px solid transparent', borderRight: '42px solid transparent', borderTop: `85px solid ${palette.secondary}`, filter: 'drop-shadow(0 8px 8px #0008)'}} />
      <div style={{position: 'relative', width: 940, height: 940, borderRadius: '50%', background: palette.panel, border: `18px solid ${palette.primary}`, boxShadow: '0 0 90px #ff3d6e55', transform: `rotate(${rotation}deg)`}}>
        {labels.map((brand, index) => {
          const angle = (index * 360) / labels.length - 90;
          const rad = (angle * Math.PI) / 180;
          const normalizedAngle = ((angle % 360) + 360) % 360;
          const isLeftSide = normalizedAngle > 90 && normalizedAngle < 270;
          const readableAngle = isLeftSide ? angle + 180 : angle;
          return (
            <div key={brand} style={{position: 'absolute', left: center + Math.cos(rad) * labelRadius, top: center + Math.sin(rad) * labelRadius, width: labelWidth, marginLeft: -labelWidth / 2, marginTop: -fontSize / 2, lineHeight: 1, whiteSpace: 'nowrap', textAlign: 'center', transformOrigin: '50% 50%', fontWeight: 800, fontSize, transform: `rotate(${readableAngle}deg)`, color: index === 0 ? palette.secondary : palette.text, textShadow: '0 2px 5px #000'}}>
              {brand}
            </div>
          );
        })}
        <div style={{position: 'absolute', inset: 295, borderRadius: '50%', background: palette.primary, border: `12px solid ${palette.secondary}`}} />
      </div>
    </AbsoluteFill>
  );
};
