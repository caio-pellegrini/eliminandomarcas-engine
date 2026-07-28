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
    <AbsoluteFill style={{...base, alignItems: 'center', opacity, textAlign: 'center', padding: '210px 70px', pointerEvents: 'none'}}>
      <div
        style={{
          width: '100%',
          maxWidth: 940,
          fontSize: 44,
          lineHeight: 1.16,
          color: palette.text,
          fontWeight: 900,
          letterSpacing: 1.2,
          textWrap: 'balance',
        }}
      >
        DIA {day}/{totalDays} ELIMINANDO MARCAS DE {niche.toUpperCase()} ATÉ SOBRAR UMA VENCEDORA
      </div>
    </AbsoluteFill>
  );
};
