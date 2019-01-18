# An abstract component to split the complex Angular Reactive Forms

Complex Angular reactive forms state management based on *Profunctor Optics*

## Install

```
npm install --save @daubihe/controlled-sub-form
```

## Usage


### Implement a SubForm Component

Create a sub-form controlled component by extending an imported abstract class. Define two functions for the profuctor lense:
- `mapControlValueToSubForm` that maps an imported control value to the sub-form
- `mapSubFormValueToControl` that maps a sub-form value to the control


```js
import { ControlledSubFormTypedComponent } from '@daubihe/controlled-sub-form';

interface Gender {
  code: string;
}

@Component({
  selector: 'app-gender',
  templateUrl: './gender.component.html'
})
export class GenderComponent extends ControlledSubFormTypedComponent<Gender> {
  public genderLabels = [
    { value: 'MALE', display: 'male' },
    { value: 'FEMALE', display: 'female' }
  ];

  constructor(formBuilder: FormBuilder) {
    super(formBuilder);
  }

  getSubFormConfig() {
    return {
      code: ['', Validators.required]
    };
  }

  protected mapControlValueToSubForm(value): Gender {
    return {
      code: value ? value.code : ''
    };
  }

  protected mapSubFormValueToControl(oldCtrlValue: any, newSubFormValue: Gender): any {
    if (!newSubFormValue.code) {
      return _cloneDeep(oldCtrlValue);
    }
    return { code: newSubFormValue.code };
  }
}

```

The control's `*.html` will look as following:

```html
<div [formGroup]="subForm">
  <div *ngFor="let genderLabel of genderLabels; let i = index">
    <label>
      <input type="radio" [value]="genderLabel.value" formControlName="code">
      <span>{{genderLabel.display}}</span>
    </label>
  </div>
  <div *ngIf="subForm.get('code').invalid && (subForm.get('code').dirty || subForm.get('code').touched)" style="color: red;">
    <div *ngIf="subForm.get('code').errors['required']">
      Gender is required.
    </div>
  </div>
</div>
```

Please notice that subForm `FormGroup` will be created automatically by the `ControlledSubFormTypedComponent` class according to the `getSubFormConfig` method defined in the component.

### Use a SubForm Component

Now you can use this gender component in your forms by assigning to it a control (the only `@Input()` param) that will contain the data. Data will be then mapped to a subForm inside the gender component and re-mapped back once changed

```html
<!-- app.component.html -->
<form [formGroup]="form">
  <app-gender [control]="form.get('gender')"></app-gender>
</form>
```

The value for the control can be passed down in this way:

```js
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent {
  form: FormGroup;
  constructor(private formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      gender: {code: 'MALE'}
    }});
  }
}
```

This allows us to split the validation and form creation logic between our *controlled sub-form* components and still have a reactive value propagation and validation flow (so the parent does not need to know about the data types of children components and the way how to validate them)


