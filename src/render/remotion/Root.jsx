import React from 'react';
import {Composition} from 'remotion';
import {SeasonVideo} from './SeasonVideo';

const defaultProps = {
  day: 1,
  totalDays: 60,
  niche: 'Carros',
  seasonName: 'Temporada 1: Carros',
  eliminatedBrand: 'Exemplo',
  brands: ['Exemplo', 'Marca A', 'Marca B', 'Marca C', 'Marca D', 'Marca E'],
  durationSeconds: 10,
};

export const RemotionRoot = () => (
  <Composition
    id="SeasonElimination"
    component={SeasonVideo}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({durationInFrames: Math.round((props.durationSeconds || 10) * 30)})}
  />
);
