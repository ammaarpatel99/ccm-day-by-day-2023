import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {SetupComponent} from "./setup/setup.component";
import {LoadingComponent} from "./loading/loading.component";
import {PaymentSetupComponent} from "./payment-setup/payment-setup.component";
import {ChangePaymentMethodComponent} from "./change-payment-method/change-payment-method.component";
import {SchemeClosedComponent} from "./scheme-closed/scheme-closed.component";

const routes: Routes = [
  // {
  //   path: 'setup',
  //   component: SetupComponent
  // },
  // {
  //   path: 'paymentsetup/:applicationID/:checkoutID',
  //   component: PaymentSetupComponent
  // },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  },
  {
    path: '',
    pathMatch: 'full',
    component: SchemeClosedComponent
  },
  {
    path: 'change-payment-method',
    component: ChangePaymentMethodComponent
  },
  // {
  //   path: ':promoCode',
  //   component: LoadingComponent
  // },
  {
    path: '**',
    component: SchemeClosedComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
