import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

export interface RouteDef {
  path: string;
  component: LazyExoticComponent<ComponentType>;
}

/**
 * Route table. Heavy pages are lazy so the 3D stack only loads where it's used. The first route
 * is also the fallback for unknown paths.
 */
export const routes: readonly RouteDef[] = [
  { path: '/', component: lazy(() => import('@/game/title/TitlePage')) },
  { path: '/play', component: lazy(() => import('@/game/PlayPage')) },
  { path: '/debug', component: lazy(() => import('./HomePage')) },
  { path: '/debug/art', component: lazy(() => import('@/debug/CardArtPage')) },
  { path: '/debug/scene', component: lazy(() => import('@/scene/ScenePlayground')) },
  { path: '/debug/clay', component: lazy(() => import('@/art/clay/ClayPlayground')) },
  { path: '/debug/ui', component: lazy(() => import('@/debug/UiGalleryPage')) },
  { path: '/debug/engine', component: lazy(() => import('@/debug/EngineSandboxPage')) },
  { path: '/debug/sheets', component: lazy(() => import('@/debug/SheetsPlayground')) },
  { path: '/debug/audio', component: lazy(() => import('@/debug/AudioLabPage')) },
];

export function matchRoute(pathname: string): RouteDef {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return routes.find((route) => route.path === normalized) ?? (routes[0] as RouteDef);
}
