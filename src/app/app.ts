import { Component } from '@angular/core';
import { BowlingGameComponent } from './bowling/bowling-game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BowlingGameComponent],
  template: `<app-bowling-game />`,
})
export class App {}
