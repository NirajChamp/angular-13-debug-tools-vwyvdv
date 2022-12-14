import { Component } from '@angular/core';
import { DebugAngularService } from './debug-angular.service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'Lazy loading feature modules';

  constructor(
    private debugAngular: DebugAngularService // dua service debug vao
  ) {}
}

/*
Copyright Google LLC. All Rights Reserved.
Use of this source code is governed by an MIT-style license that
can be found in the LICENSE file at https://angular.io/license
*/
