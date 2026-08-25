import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';

@Component({
  selector: 'app-tabs',
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
  template: `<ion-tabs
    ><ion-tab-bar slot="bottom" aria-label="Main navigation"
      ><ion-tab-button tab="home" href="/tabs/home"
        ><ion-icon name="today-outline"></ion-icon><ion-label>Home</ion-label></ion-tab-button
      ><ion-tab-button tab="upcoming" href="/tabs/upcoming"
        ><ion-icon name="notifications-outline"></ion-icon><ion-label>Upcoming</ion-label></ion-tab-button
      ><ion-tab-button tab="people" href="/tabs/people"
        ><ion-icon name="people-outline"></ion-icon><ion-label>People</ion-label></ion-tab-button
      ><ion-tab-button tab="calendar" href="/tabs/calendar"
        ><ion-icon name="calendar-outline"></ion-icon><ion-label>Calendar</ion-label></ion-tab-button
      ></ion-tab-bar
    ></ion-tabs
  >`,
})
export class TabsPage {}
