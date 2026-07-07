import { Component } from '@angular/core';
import { BowlingGameComponent } from './bowling/bowling-game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BowlingGameComponent],
  template: `
    <app-bowling-game />
    <footer class="app-footer">
      <a href="https://github.com/stavgian/bowling-game" target="_blank" rel="noopener noreferrer">
        View source on GitHub
      </a>
    </footer>
  `,
  styles: [
    `
      .app-footer {
        max-width: 720px;
        margin: 0.5rem auto 2rem;
        padding: 0 1.5rem;
        text-align: center;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        font-size: 0.85rem;
        letter-spacing: 0.02em;
        color: #7b8794;
      }

      .app-footer a {
        color: #52606d;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: color 0.15s ease, border-color 0.15s ease;
      }

      .app-footer a:hover {
        color: #2563eb;
        border-color: currentColor;
      }
    `,
  ],
})
export class App {}
