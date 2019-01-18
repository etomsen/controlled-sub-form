import { Input, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, AbstractControl, ValidatorFn, FormArray } from '@angular/forms';
import { isEqual as _isEqual, cloneDeep as _cloneDeep, isEmpty as _isEmpty, omit as _omit, set as _set } from 'lodash';
import { Subject, Observable } from 'rxjs';
import { takeUntil, pairwise, distinctUntilChanged, debounceTime, map, startWith, scan } from 'rxjs/operators';

export type SubFormTypeOption<SubFormType> = keyof SubFormType;

export type ValueValidatorTuple<ValueType> = Array<ValueType | ValidatorFn>;

export type SubFormTypeConfig<SubFormType> = {
  [o in SubFormTypeOption<SubFormType>]: SubFormType[o] | ValueValidatorTuple<SubFormType[o]> | FormArray
};

interface FormState {
  value: any;
  pristine: boolean;
  valid: boolean;
}

interface ControlledSubFormState {
  control: FormState;
  subForm: FormState;
}

// type Mapper<T, S> = (value: T) => S;
// type ReMapper<T, S> = (oldOuter: T, newInner: S) => T;
// type Reducer<T> = (state: T, action: {__type: string, payload: any}) => T;

const ACTION_CTRL_VALUE_INIT = 'ACTION_CTRL_VALUE_INIT';
const ACTION_CTRL_VALUE_CHANGE = 'ACTION_CTRL_VALUE_CHANGE';
const ACTION_SUB_FORM_VALUE_CHANGE = 'ACTION_SUB_FORM_VALUE_CHANGE';
const ACTION_SUB_FORM_STATUS_CHANGE = 'ACTION_SUB_FORM_STATUS_CHANGE';

export abstract class ControlledSubFormTypedComponent<SubFormType> implements AfterViewInit, OnChanges, OnDestroy {
  @Input() disabled = false;
  @Input() control!: FormControl;

  public subForm: FormGroup;
  protected formBuilder: FormBuilder;
  private state$: Observable<ControlledSubFormState>;
  private action$ = new Subject<any>();
  private destroy$ = new Subject<boolean>();

  constructor(formBuilder: FormBuilder) {
    this.formBuilder = formBuilder;
    this.subForm = this.formBuilder.group(this.getSubFormConfig(), this.getSubFormOptions());
    const initialState: ControlledSubFormState = {
      control: {
        value: null,
        pristine: true,
        valid: true
      },
      subForm: {
        value: this.subForm.value,
        pristine: true,
        valid: this.subForm.valid
      }
    };

    this.state$ = this.action$
      .pipe(startWith(initialState))
      .pipe(scan(this.reducer.bind(this)));

    this.state$
      .pipe(distinctUntilChanged(_isEqual))
      .pipe(pairwise())
      .pipe(takeUntil(this.destroy$))
      .subscribe(([prevState, nextState]) => {
        if (! _isEqual(prevState.subForm, nextState.subForm)) {
          this.renderSubFormStateChanges(nextState);
        }
        if (! _isEqual(prevState.control, nextState.control)) {
          this.renderControlStateChanges(nextState);
        }
      });


    this.subForm.valueChanges
      .pipe(map(value => ({value, pristine: this.subForm.pristine, valid: this.subForm.valid})))
      .pipe(distinctUntilChanged(_isEqual))
      .pipe(debounceTime(100))
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => this.onActionSubFormValue(state));

    this.subForm.statusChanges
      .pipe(map(_ => ({pristine: this.subForm.pristine, valid: this.subForm.valid})))
      .pipe(debounceTime(100))
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => this.onActionSubFormStatus(status));
  }

  reducer(state: ControlledSubFormState, action: {__type: string, payload: any}): ControlledSubFormState {
    switch (action.__type) {
      case ACTION_CTRL_VALUE_INIT: {
        const mappedCtrlValue = this.mapControlValueToSubForm(action.payload.value);
        const newState: ControlledSubFormState = _cloneDeep(state);
        newState.control.value = action.payload.value;
        newState.control.pristine = true;

        if (_isEqual(newState.subForm.value, mappedCtrlValue) && !action.payload.ctrlValidator) {
          // in case of INIT control should take the validity from sub-form
          newState.control.valid = newState.subForm.valid;
        } else {
          newState.control.valid = true;
          newState.subForm.valid = true;
        }
        newState.subForm.value = mappedCtrlValue;
        return newState;
      }
      case ACTION_CTRL_VALUE_CHANGE: {
        const mappedCtrlValue = this.mapControlValueToSubForm(action.payload.value);
        const newState: ControlledSubFormState = _cloneDeep(state);
        newState.control = {...newState.control, ...action.payload};
        newState.subForm.value = mappedCtrlValue;
        if (newState.control.pristine) {
          newState.subForm.pristine = true;
        }
        return newState;
      }
      case ACTION_SUB_FORM_VALUE_CHANGE: {
        const newState: ControlledSubFormState = _cloneDeep(state);
        newState.subForm = {...newState.subForm, ...action.payload};
        const mappedSubFormValue = this.mapSubFormValueToControl(state.control.value, action.payload.value);
        newState.control.value = mappedSubFormValue;
        if (!newState.subForm.pristine) {
          newState.control.pristine = false;
        }
        newState.control.valid = action.payload.valid;
        return newState;
      }
      case ACTION_SUB_FORM_STATUS_CHANGE: {
        const newState: ControlledSubFormState = _cloneDeep(state);
        newState.subForm.valid = action.payload.valid;
        newState.subForm.pristine = action.payload.pristine;
        if (!newState.subForm.pristine) {
          newState.control.pristine = false;
        }
        newState.control.valid = action.payload.valid;
        return newState;
      }
      default:
        return state;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.disabled) {
      changes.disabled.currentValue ? this.subForm.disable() : this.subForm.enable();
    }
    if (changes.control && changes.control.currentValue && changes.control.firstChange) {
      this.action$.next({__type: ACTION_CTRL_VALUE_INIT, payload: {
        value: this.control.value,
        valid: this.control.valid,
        ctrlValidator: !!this.control.validator
      }});
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.control.valueChanges
        .pipe(map(value => ({value, valid: this.isControlValid, pristine: this.control.pristine})))
        .pipe(debounceTime(100))
        .pipe(takeUntil(this.destroy$))
        .subscribe((value) => this.onActionControlValue(value));
    });
  }

  ngOnDestroy() {
    this.destroy$.next(true);
    this.destroy$.unsubscribe();
  }

  protected abstract getSubFormConfig(): SubFormTypeConfig<SubFormType>;

  renderControlStateChanges(state: ControlledSubFormState) {
    let result = false;
    if (!_isEqual(state.control.value, this.control.value) && _isEqual(state.subForm.value, this.subForm.value)) {
      // the state.ctrl.value change comes from the subForm value.change => just update the ctrl
      this.control.setValue(state.control.value, { emitEvent: false });
      result = true;
    }
    if (!state.control.pristine && this.control.pristine) {
      this.control.markAsDirty({ onlySelf: true });
      result = true;
    }
    if (!state.control.valid  && this.control.valid && !this.control.validator) {
      const ctrlSelfErrors = _omit(this.control.errors || {}, ['subFormError']);
      const errors = Object.assign({}, ctrlSelfErrors, { subFormError: true });
      this.control.setErrors(errors, { emitEvent: false });
      result = true;
    }
    if (state.control.valid && !this.control.valid && !this.control.validator) {
      const ctrlSelfErrors = _omit(this.control.errors || {}, ['subFormError']);
      this.control.setErrors(_isEmpty(ctrlSelfErrors) ? null : ctrlSelfErrors, { emitEvent: false });
      result = true;
    }
    if (result && this.control.parent instanceof AbstractControl) {
      this.control.parent.updateValueAndValidity();
    }
  }

  renderSubFormStateChanges(state: ControlledSubFormState) {
    if (!_isEqual(state.subForm.value, this.subForm.value) && _isEqual(state.control.value, this.control.value)) {
      // the state.subForm.value change comes from the ctrl value change => just update the subForm
      if (state.control.pristine) {
        // if we've reset the control value => reset the value for subForm
        const subFormNewValue: any = {};
        Object.keys(state.subForm.value).forEach(field => {
          if (this.subForm.get(field)) {
            subFormNewValue[field] = state.subForm.value[field];
          }
        });
        this.subForm.reset(subFormNewValue, { onlySelf: true });
      } else {
        const subFormNewValue: any = {};
        // if the control value has just changed => update the value of the changed fields only
        Object.keys(state.subForm.value).forEach(field => {
          const isFieldDiffersFromState = !_isEqual(state.subForm.value[field], (this.subForm.get(field) as AbstractControl).value);
          if (this.subForm.get(field) && isFieldDiffersFromState) {
            subFormNewValue[field] = state.subForm.value[field];
          }
        });
        if (!_isEmpty(subFormNewValue)) {
          this.subForm.patchValue(subFormNewValue, { onlySelf: true });
          this.subForm.markAsDirty();
        }
      }
    }
  }

  protected mapControlValueToSubForm(value: any): SubFormType {
    return value;
  }

  protected mapSubFormValueToControl(oldCtrlValue: any, newSubFormValue: SubFormType) {
    return newSubFormValue;
  }

  private onActionControlValue(value: FormState) {
    this.action$.next({__type: ACTION_CTRL_VALUE_CHANGE, payload: value});
  }

  private onActionSubFormStatus(status: {valid: boolean, pristine: boolean}) {
    this.action$.next({__type: ACTION_SUB_FORM_STATUS_CHANGE, payload: status});
  }

  private onActionSubFormValue(state: FormState) {
    this.action$.next({__type: ACTION_SUB_FORM_VALUE_CHANGE, payload: state});
  }

  protected get isSubFormValid() {
    return this.subForm.valid || this.subForm.disabled;
    // DISABLED is considered valid by default
  }

  protected get isControlValid() {
    return this.control.valid || this.control.disabled;
    // DISABLED is considered valid by default
  }

  protected getSubFormOptions(): any {
    return {};
  }
}
