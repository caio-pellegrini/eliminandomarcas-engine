import React from 'react';
import {AbsoluteFill} from 'remotion';
import {FinalCard} from './components/FinalCard';
import {Opening} from './components/Opening';
import {Roulette} from './components/Roulette';
import {palette} from './styles';

export const SeasonVideo = (props) => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 35%, ${palette.panel}, ${palette.background} 68%)`}}>
    <Opening {...props} />
    <Roulette {...props} />
    <FinalCard {...props} />
  </AbsoluteFill>
);
