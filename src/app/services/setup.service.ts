import { Injectable } from '@angular/core';
import {from, map, of, switchMap, tap} from "rxjs";
import {Functions, httpsCallable} from "@angular/fire/functions";
import {
  APIEndpoints,
  ApplicationSummaryReq,
  ApplicationSummaryRes,
  DonationLength,
  GetApplicationReq,
  GetApplicationRes,
  SetDefaultPaymentReq,
  SetDefaultPaymentRes,
  SetupPaymentReq,
  SetupPaymentRes,
  SetupSubscriptionReq, SetupSubscriptionRes
} from "../../../functions/src/api-types";
import {DonationApplicationService} from "./donation-application.service";

export enum CheckoutState {
  NOT_BEGUN,
  PRE_CHECKOUT_LOADING,
  BEGUN,
  RE_ESTABLISHING,
  PAYMENT_ESTABLISHED,
  PAYMENT_READY,
  COMPLETE
}

@Injectable({
  providedIn: 'root'
})
export class SetupService {
  private readonly successURL = `${location.origin}/paymentsetup`;
  private _checkoutState: CheckoutState = CheckoutState.NOT_BEGUN;
  get checkoutState() { return this._checkoutState }
  private checkoutData = {donationID: '', checkoutID: ''}

  getPreCheckoutSummary() {
    return of(true).pipe(
      tap(() => this._checkoutState = CheckoutState.PRE_CHECKOUT_LOADING),
      switchMap(() =>
        from(httpsCallable<ApplicationSummaryReq, ApplicationSummaryRes>(this.functions, APIEndpoints.APPLICATION_SUMMARY)({
          email: this.applicationService.donorInfo.controls.email.value as string,
          phone: this.applicationService.donorInfo.controls.phone.value as string,
          firstName: this.applicationService.donorInfo.controls.firstName.value as string,
          surname: this.applicationService.donorInfo.controls.surname.value as string,
          address: this.applicationService.donorInfo.controls.address.value as string,
          postcode: this.applicationService.donorInfo.controls.postcode.value as string,
          giftAid: this.applicationService.consent.controls.giftAid.value as boolean,
          giftAidConsentDate: new Date().getTime(),
          onBehalfOf: this.applicationService.donationInfo.controls.onBehalfOf.value as string,
          anonymous: this.applicationService.donationInfo.controls.anonymous.value as boolean,
          amount: this.applicationService.donationAmount.value as number,
          donationLength: this.applicationService.donationLength.value as DonationLength,
          status: "application",
          promoCode: this.applicationService.promoCode,
          iftarAmount: this.applicationService.iftarDonationAmount.value as number
        }))
      ),
      map(({data}) => data),
      tap(() => this._checkoutState = CheckoutState.NOT_BEGUN)
    )
  }

  getCheckoutSummary() {
    return of(true).pipe(
      switchMap(() =>
        from(httpsCallable<GetApplicationReq, GetApplicationRes>(this.functions, APIEndpoints.GET_APPLICATION)({
          donationID: this.checkoutData.donationID
        }))
      ),
      map(({data}) => data),
      tap(() => this._checkoutState = CheckoutState.PAYMENT_ESTABLISHED)
    )
  }

  setupPayment() {
    return of(true).pipe(
      tap(() => this._checkoutState = CheckoutState.BEGUN),
      switchMap(() =>
        from(httpsCallable<SetupPaymentReq, SetupPaymentRes>(this.functions, APIEndpoints.SETUP_PAYMENT)({
          email: this.applicationService.donorInfo.controls.email.value as string,
          phone: this.applicationService.donorInfo.controls.phone.value as string,
          firstName: this.applicationService.donorInfo.controls.firstName.value as string,
          surname: this.applicationService.donorInfo.controls.surname.value as string,
          address: this.applicationService.donorInfo.controls.address.value as string,
          postcode: this.applicationService.donorInfo.controls.postcode.value as string,
          giftAid: this.applicationService.consent.controls.giftAid.value as boolean,
          giftAidConsentDate: new Date().getTime(),
          onBehalfOf: this.applicationService.donationInfo.controls.onBehalfOf.value as string,
          anonymous: this.applicationService.donationInfo.controls.anonymous.value as boolean,
          amount: this.applicationService.donationAmount.value as number,
          donationLength: this.applicationService.donationLength.value as DonationLength,
          status: "application",
          successURL: this.successURL,
          promoCode: this.applicationService.promoCode,
          iftarAmount: this.applicationService.iftarDonationAmount.value as number,
        }))
      ),
      map(({data}) => {
        location.replace(data.setupURL)
      })
    )
  }

  setDefaultPaymentMethod() {
    return of(true).pipe(
      switchMap(() =>
        from(httpsCallable<SetDefaultPaymentReq, SetDefaultPaymentRes>(this.functions, APIEndpoints.SET_DEFAULT_PAYMENT_METHOD)({
          donationID: this.checkoutData.donationID
        }))
      ),
      map(() => {}),
      tap(() => this._checkoutState = CheckoutState.PAYMENT_READY)
    )
  }

  setupSubscription() {
    return of(true).pipe(
      switchMap(() =>
        from(httpsCallable<SetupSubscriptionReq, SetupSubscriptionRes>(this.functions, APIEndpoints.SETUP_SUBSCRIPTION)({
          donationID: this.checkoutData.donationID
        }))
      ),
      map(({data}) => data),
      tap(() => this._checkoutState = CheckoutState.COMPLETE)
    )
  }

  completePaymentSetup(donationID: string, checkoutID: string) {
    this._checkoutState = CheckoutState.RE_ESTABLISHING
    this.checkoutData = {donationID, checkoutID}
  }

  constructor(
    private readonly functions: Functions,
    private readonly applicationService: DonationApplicationService
  ) { }
}
