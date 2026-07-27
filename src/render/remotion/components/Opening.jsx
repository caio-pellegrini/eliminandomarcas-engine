import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {base, palette} from '../styles';

export const Opening = ({day, totalDays, niche, seasonName}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = interpolate(frame, [0, 0.25 * fps, 1.7 * fps, 2 * fps], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(frame, [0, 0.45 * fps], [0.88, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{...base, alignItems: 'center', justifyContent: 'center', opacity, transform: `scale(${scale})`, textAlign: 'center', padding: 90}}>
      <div style={{fontSize: 74, color: palette.secondary, fontWeight: 900, letterSpacing: 3}}>DIA {day}/{totalDays}</div>
      <div style={{fontSize: 92, lineHeight: 1.04, fontWeight: 900, marginTop: 42}}>ELIMINANDO MARCAS DE {niche.toUpperCase()}</div>
      <div style={{fontSize: 48, color: palette.muted, marginTop: 40}}>até sobrar uma vencedora</div>
      <div style={{fontSize: 42, color: palette.primary, marginTop: 80}}>{seasonName}</div>
    </AbsoluteFill>
  );
};
