import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {getVideoTiming} from '../../videoTiming';
import {base, palette} from '../styles';

export const Opening = ({day, totalDays, niche, durationSeconds}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {rouletteEndFrame} = getVideoTiming(durationSeconds, fps);
  const opacity = interpolate(frame, [rouletteEndFrame - 10, rouletteEndFrame], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{...base, alignItems: 'center', opacity, textAlign: 'center', padding: '90px 70px', pointerEvents: 'none'}}>
      <div style={{fontSize: 62, color: palette.secondary, fontWeight: 900, letterSpacing: 3}}>DIA {day}/{totalDays}</div>
      <div style={{fontSize: 58, lineHeight: 1.05, fontWeight: 900, marginTop: 18}}>ELIMINANDO MARCAS DE {niche.toUpperCase()}</div>
    </AbsoluteFill>
  );
};
