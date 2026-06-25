import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PinBoard',
    short_name: 'PinBoard',
    description: 'Beautiful tactile digital corkboard with AI-powered note extraction.',
    start_url: '/',
    display: 'standalone',
    background_color: '#c5a16e',
    theme_color: '#3f2a1f',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    orientation: 'any',
  };
}
