import { AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ValidatorFn, FormArray } from '@angular/forms';
export declare type SubFormTypeOption<SubFormType> = keyof SubFormType;
export declare type ValueValidatorTuple<ValueType> = Array<ValueType | ValidatorFn>;
export declare type SubFormTypeConfig<SubFormType> = {
    [o in SubFormTypeOption<SubFormType>]: SubFormType[o] | ValueValidatorTuple<SubFormType[o]> | FormArray;
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
export declare abstract class ControlledSubFormTypedComponent<SubFormType> implements AfterViewInit, OnChanges, OnDestroy {
    disabled: boolean;
    control: FormControl;
    subForm: FormGroup;
    protected formBuilder: FormBuilder;
    private state$;
    private action$;
    private destroy$;
    constructor(formBuilder: FormBuilder);
    reducer(state: ControlledSubFormState, action: {
        __type: string;
        payload: any;
    }): ControlledSubFormState;
    ngOnChanges(changes: SimpleChanges): void;
    ngAfterViewInit(): void;
    ngOnDestroy(): void;
    protected abstract getSubFormConfig(): SubFormTypeConfig<SubFormType>;
    renderControlStateChanges(state: ControlledSubFormState): void;
    renderSubFormStateChanges(state: ControlledSubFormState): void;
    protected mapControlValueToSubForm(value: any): SubFormType;
    protected mapSubFormValueToControl(oldCtrlValue: any, newSubFormValue: SubFormType): SubFormType;
    private onActionControlValue;
    private onActionSubFormStatus;
    private onActionSubFormValue;
    protected readonly isSubFormValid: boolean;
    protected readonly isControlValid: boolean;
    protected getSubFormOptions(): any;
}
export {};
