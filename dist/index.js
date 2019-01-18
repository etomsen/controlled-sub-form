"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const lodash_1 = require("lodash");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
// type Mapper<T, S> = (value: T) => S;
// type ReMapper<T, S> = (oldOuter: T, newInner: S) => T;
// type Reducer<T> = (state: T, action: {__type: string, payload: any}) => T;
const ACTION_CTRL_VALUE_INIT = 'ACTION_CTRL_VALUE_INIT';
const ACTION_CTRL_VALUE_CHANGE = 'ACTION_CTRL_VALUE_CHANGE';
const ACTION_SUB_FORM_VALUE_CHANGE = 'ACTION_SUB_FORM_VALUE_CHANGE';
const ACTION_SUB_FORM_STATUS_CHANGE = 'ACTION_SUB_FORM_STATUS_CHANGE';
class ControlledSubFormTypedComponent {
    constructor(formBuilder) {
        this.disabled = false;
        this.action$ = new rxjs_1.Subject();
        this.destroy$ = new rxjs_1.Subject();
        this.formBuilder = formBuilder;
        this.subForm = this.formBuilder.group(this.getSubFormConfig(), this.getSubFormOptions());
        const initialState = {
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
            .pipe(operators_1.startWith(initialState))
            .pipe(operators_1.scan(this.reducer.bind(this)));
        this.state$
            .pipe(operators_1.distinctUntilChanged(lodash_1.isEqual))
            .pipe(operators_1.pairwise())
            .pipe(operators_1.takeUntil(this.destroy$))
            .subscribe(([prevState, nextState]) => {
            if (!lodash_1.isEqual(prevState.subForm, nextState.subForm)) {
                this.renderSubFormStateChanges(nextState);
            }
            if (!lodash_1.isEqual(prevState.control, nextState.control)) {
                this.renderControlStateChanges(nextState);
            }
        });
        this.subForm.valueChanges
            .pipe(operators_1.map(value => ({ value, pristine: this.subForm.pristine, valid: this.subForm.valid })))
            .pipe(operators_1.distinctUntilChanged(lodash_1.isEqual))
            .pipe(operators_1.debounceTime(100))
            .pipe(operators_1.takeUntil(this.destroy$))
            .subscribe(state => this.onActionSubFormValue(state));
        this.subForm.statusChanges
            .pipe(operators_1.map(_ => ({ pristine: this.subForm.pristine, valid: this.subForm.valid })))
            .pipe(operators_1.debounceTime(100))
            .pipe(operators_1.takeUntil(this.destroy$))
            .subscribe(status => this.onActionSubFormStatus(status));
    }
    reducer(state, action) {
        switch (action.__type) {
            case ACTION_CTRL_VALUE_INIT: {
                const mappedCtrlValue = this.mapControlValueToSubForm(action.payload.value);
                const newState = lodash_1.cloneDeep(state);
                newState.control.value = action.payload.value;
                newState.control.pristine = true;
                if (lodash_1.isEqual(newState.subForm.value, mappedCtrlValue) && !action.payload.ctrlValidator) {
                    // in case of INIT control should take the validity from sub-form
                    newState.control.valid = newState.subForm.valid;
                }
                else {
                    newState.control.valid = true;
                    newState.subForm.valid = true;
                }
                newState.subForm.value = mappedCtrlValue;
                return newState;
            }
            case ACTION_CTRL_VALUE_CHANGE: {
                const mappedCtrlValue = this.mapControlValueToSubForm(action.payload.value);
                const newState = lodash_1.cloneDeep(state);
                newState.control = Object.assign({}, newState.control, action.payload);
                newState.subForm.value = mappedCtrlValue;
                if (newState.control.pristine) {
                    newState.subForm.pristine = true;
                }
                return newState;
            }
            case ACTION_SUB_FORM_VALUE_CHANGE: {
                const newState = lodash_1.cloneDeep(state);
                newState.subForm = Object.assign({}, newState.subForm, action.payload);
                const mappedSubFormValue = this.mapSubFormValueToControl(state.control.value, action.payload.value);
                newState.control.value = mappedSubFormValue;
                if (!newState.subForm.pristine) {
                    newState.control.pristine = false;
                }
                newState.control.valid = action.payload.valid;
                return newState;
            }
            case ACTION_SUB_FORM_STATUS_CHANGE: {
                const newState = lodash_1.cloneDeep(state);
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
    ngOnChanges(changes) {
        if (changes.disabled) {
            changes.disabled.currentValue ? this.subForm.disable() : this.subForm.enable();
        }
        if (changes.control && changes.control.currentValue && changes.control.firstChange) {
            this.action$.next({ __type: ACTION_CTRL_VALUE_INIT, payload: {
                    value: this.control.value,
                    valid: this.control.valid,
                    ctrlValidator: !!this.control.validator
                } });
        }
    }
    ngAfterViewInit() {
        setTimeout(() => {
            this.control.valueChanges
                .pipe(operators_1.map(value => ({ value, valid: this.isControlValid, pristine: this.control.pristine })))
                .pipe(operators_1.debounceTime(100))
                .pipe(operators_1.takeUntil(this.destroy$))
                .subscribe((value) => this.onActionControlValue(value));
        });
    }
    ngOnDestroy() {
        this.destroy$.next(true);
        this.destroy$.unsubscribe();
    }
    renderControlStateChanges(state) {
        let result = false;
        if (!lodash_1.isEqual(state.control.value, this.control.value) && lodash_1.isEqual(state.subForm.value, this.subForm.value)) {
            // the state.ctrl.value change comes from the subForm value.change => just update the ctrl
            this.control.setValue(state.control.value, { emitEvent: false });
            result = true;
        }
        if (!state.control.pristine && this.control.pristine) {
            this.control.markAsDirty({ onlySelf: true });
            result = true;
        }
        if (!state.control.valid && this.control.valid && !this.control.validator) {
            const ctrlSelfErrors = lodash_1.omit(this.control.errors || {}, ['subFormError']);
            const errors = Object.assign({}, ctrlSelfErrors, { subFormError: true });
            this.control.setErrors(errors, { emitEvent: false });
            result = true;
        }
        if (state.control.valid && !this.control.valid && !this.control.validator) {
            const ctrlSelfErrors = lodash_1.omit(this.control.errors || {}, ['subFormError']);
            this.control.setErrors(lodash_1.isEmpty(ctrlSelfErrors) ? null : ctrlSelfErrors, { emitEvent: false });
            result = true;
        }
        if (result && this.control.parent instanceof forms_1.AbstractControl) {
            this.control.parent.updateValueAndValidity();
        }
    }
    renderSubFormStateChanges(state) {
        if (!lodash_1.isEqual(state.subForm.value, this.subForm.value) && lodash_1.isEqual(state.control.value, this.control.value)) {
            // the state.subForm.value change comes from the ctrl value change => just update the subForm
            if (state.control.pristine) {
                // if we've reset the control value => reset the value for subForm
                const subFormNewValue = {};
                Object.keys(state.subForm.value).forEach(field => {
                    if (this.subForm.get(field)) {
                        subFormNewValue[field] = state.subForm.value[field];
                    }
                });
                this.subForm.reset(subFormNewValue, { onlySelf: true });
            }
            else {
                const subFormNewValue = {};
                // if the control value has just changed => update the value of the changed fields only
                Object.keys(state.subForm.value).forEach(field => {
                    const isFieldDiffersFromState = !lodash_1.isEqual(state.subForm.value[field], this.subForm.get(field).value);
                    if (this.subForm.get(field) && isFieldDiffersFromState) {
                        subFormNewValue[field] = state.subForm.value[field];
                    }
                });
                if (!lodash_1.isEmpty(subFormNewValue)) {
                    this.subForm.patchValue(subFormNewValue, { onlySelf: true });
                    this.subForm.markAsDirty();
                }
            }
        }
    }
    mapControlValueToSubForm(value) {
        return value;
    }
    mapSubFormValueToControl(oldCtrlValue, newSubFormValue) {
        return newSubFormValue;
    }
    onActionControlValue(value) {
        this.action$.next({ __type: ACTION_CTRL_VALUE_CHANGE, payload: value });
    }
    onActionSubFormStatus(status) {
        this.action$.next({ __type: ACTION_SUB_FORM_STATUS_CHANGE, payload: status });
    }
    onActionSubFormValue(state) {
        this.action$.next({ __type: ACTION_SUB_FORM_VALUE_CHANGE, payload: state });
    }
    get isSubFormValid() {
        return this.subForm.valid || this.subForm.disabled;
        // DISABLED is considered valid by default
    }
    get isControlValid() {
        return this.control.valid || this.control.disabled;
        // DISABLED is considered valid by default
    }
    getSubFormOptions() {
        return {};
    }
}
__decorate([
    core_1.Input()
], ControlledSubFormTypedComponent.prototype, "disabled", void 0);
__decorate([
    core_1.Input()
], ControlledSubFormTypedComponent.prototype, "control", void 0);
exports.ControlledSubFormTypedComponent = ControlledSubFormTypedComponent;
