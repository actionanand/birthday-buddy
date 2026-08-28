import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./features/tabs/tabs.page').then(module => module.TabsPage),
    children: [
      { path: 'home', loadComponent: () => import('./features/home/home.page').then(module => module.HomePage) },
      {
        path: 'upcoming',
        loadComponent: () => import('./features/upcoming/upcoming.page').then(module => module.UpcomingPage),
      },
      {
        path: 'people',
        loadComponent: () => import('./features/people/people.page').then(module => module.PeoplePage),
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/calendar/calendar.page').then(module => module.CalendarPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  {
    path: 'person/new',
    pathMatch: 'full',
    redirectTo: 'occasion/new',
  },
  {
    path: 'person/:id/edit',
    loadComponent: () => import('./features/people/person-editor.page').then(module => module.PersonEditorPage),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'person/:id',
    loadComponent: () => import('./features/people/person-detail.page').then(module => module.PersonDetailPage),
  },
  {
    path: 'occasion/new',
    loadComponent: () => import('./features/occasions/occasion-editor.page').then(module => module.OccasionEditorPage),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'occasion/:id',
    loadComponent: () => import('./features/occasions/occasion-detail.page').then(module => module.OccasionDetailPage),
  },
  {
    path: 'occasion/:id/edit',
    loadComponent: () => import('./features/occasions/occasion-editor.page').then(module => module.OccasionEditorPage),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then(module => module.SettingsPage),
  },
  {
    path: 'trash',
    loadComponent: () => import('./features/trash/trash.page').then(module => module.TrashPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'tabs/home' },
  { path: '**', redirectTo: 'tabs/home' },
];
