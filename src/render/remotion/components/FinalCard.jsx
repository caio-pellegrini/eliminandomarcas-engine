import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {getVideoTiming} from '../../videoTiming';
import {base, palette} from '../styles';

export const FinalCard = ({eliminatedBrand, durationSeconds}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {finalCardStartFrame: start} = getVideoTiming(durationSeconds, fps);
  const progress = spring({frame: frame - start, fps, config: {damping: 12, stiffness: 160}});
  const opacity = interpolate(frame, [start, start + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{...base, alignItems: 'center', justifyContent: 'center', opacity, textAlign: 'center', padding: 85}}>
      <div style={{fontSize: 76, color: palette.primary, fontWeight: 900, letterSpacing: 5}}>ELIMINADA:</div>
      <div style={{fontSize: eliminatedBrand.length > 14 ? 115 : 150, lineHeight: 1, fontWeight: 900, marginTop: 55, color: palette.secondary, transform: `scale(${progress})`, textShadow: '0 14px 35px #000'}}>{eliminatedBrand}</div>
      <div style={{fontSize: 38, color: palette.muted, marginTop: 100}}>@eliminandomarcas</div>
    </AbsoluteFill>
  );
};
