import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AppComponent } from './app.component';
import { DEFAULT_SETTINGS } from './core/models/domain.models';
import { BirthdayStoreService } from './core/services/birthday-store.service';
import { ContactSyncService } from './core/services/contact-sync.service';
import { PinService } from './core/services/pin.service';
import { ReminderSchedulerService } from './core/services/reminder-scheduler.service';

vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) } }));

describe('AppComponent', () => {
  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: BirthdayStoreService,
          useValue: { settings: signal(DEFAULT_SETTINGS), initialize: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: PinService, useValue: { unlocked: signal(true), initialize: vi.fn().mockResolvedValue(undefined) } },
        { provide: ReminderSchedulerService, useValue: { reconcileAll: vi.fn().mockResolvedValue('web') } },
        { provide: ContactSyncService, useValue: { automaticScanIfDue: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
