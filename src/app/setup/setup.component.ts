import {Component, OnDestroy, OnInit} from '@angular/core';
import {Functions, httpsCallable} from "@angular/fire/functions";
import {MatStepper} from "@angular/material/stepper";
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {AsyncSubject, combineLatest, takeUntil} from "rxjs";

interface StripeSetupData {
  successURL: string;
  amount: number;
  email: string;
  phone: string;
  name: string;
  wantsBrick: boolean;
  anonymous: boolean;
  giftAid: boolean;
  startDate: number;
  iterations: number;
}

interface StripeSetupRes {
  sessionURL: string;
}

@Component({
  selector: 'app-setup',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss']
})
export class SetupComponent implements OnInit, OnDestroy {
  private readonly destroyed = new AsyncSubject();

  readonly amount = new FormControl<number>(30, [
    Validators.min(30),
    control =>
    Math.floor(control.value * 100) / 100 === control.value ? null
      : {invalidAmount: `Amount cannot have more than 2 decimal places.`}
  ])

  details = new FormGroup({
    email: new FormControl('', [Validators.email, Validators.required]),
    phone: new FormControl('', Validators.required),
    name: new FormControl('', [Validators.required, Validators.maxLength(25)]),
    wantsBrick: new FormControl(false),
    anonymous: new FormControl(false)
  })

  disclaimers = new FormGroup({
    giftAid: new FormControl(false),
    privacyPolicy: new FormControl(false, Validators.requiredTrue),
    disclaimer: new FormControl(false, Validators.requiredTrue)
  })

  constructor(
    private readonly functions: Functions
  ) { }

  ngOnInit(): void {
    this.amount.valueChanges.pipe(
      takeUntil(this.destroyed)
    ).subscribe(value => {
      this.details.controls.wantsBrick.setValue((value || 0) >= 30)
    })
    combineLatest([this.details.controls.anonymous.valueChanges, this.details.controls.wantsBrick.valueChanges]).pipe(
      takeUntil(this.destroyed)
    ).subscribe(([anonymous, brick]) => {
      if (anonymous && !brick) {
        this.details.controls.name.clearValidators()
        this.details.controls.name.setValue('')
      } else {
        this.details.controls.name.addValidators([Validators.required, Validators.maxLength(25)])
      }
      this.details.controls.name.updateValueAndValidity()
    })
  }

  setAmount(amount: number, stepper: MatStepper) {
    this.amount.setValue(amount);
    this.amount.markAsDirty();
    setTimeout(() => stepper.next(), 100)
  }

  setupPayment() {
    httpsCallable<StripeSetupData, StripeSetupRes>(this.functions, 'stripeSetup')({
      successURL: `${location.origin}/setup/success`,
      amount: this.amount.value as number * 100,
      email: this.details.controls.email.value as string,
      phone: this.details.controls.phone.value as string,
      name: this.details.controls.name.value as string,
      wantsBrick: this.details.controls.wantsBrick.value as boolean,
      anonymous: this.details.controls.anonymous.value as boolean,
      giftAid: this.disclaimers.controls.giftAid.value as boolean,
      iterations: 30,
      startDate: new Date("2023-03-23").getTime()
    }).then(res => {
      window.location.href = res.data.sessionURL;
    })
  }

  ngOnDestroy(): void {
    this.destroyed.next(true)
    this.destroyed.complete()
  }
}
