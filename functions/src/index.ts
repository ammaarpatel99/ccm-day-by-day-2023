import * as functions from "firebase-functions";
import {db} from "./database";
import {
  changePaymentMethod as stripeChangePaymentMethod,
  createSetupSession,
  createSubscriptionSchedule,
  makeCustomer,
  setDefaultPaymentMethod,
} from "./stripe";
import {
  ApplicationSummaryReq,
  ApplicationSummaryRes,
  ConfigRes,
  GetApplicationReq,
  GetApplicationRes,
  SetDefaultPaymentReq,
  SetDefaultPaymentRes,
  SetupPaymentReq,
  SetupPaymentRes,
  SetupSubscriptionReq,
  SetupSubscriptionRes,
  ChangePaymentMethodRes,
  ChangePaymentMethodReq,
} from "./api-types";
import {configuration} from "./settings";
import {processSubscriptionInfo} from "./processSubscriptionInfo";
import {ApplicationWithCustomer, PromoCode, Subscription} from "./helpers";
import {sendChangePaymentMethodEmail, sendConfirmationEmail} from "./mail";
import {incrementIDsAndPledges} from "./counter";

export * as admin from "./admin";

export const config = functions.https.onCall((): ConfigRes => {
  return configuration();
});

export const setupPayment = functions.https.onCall(
  async (data: SetupPaymentReq): Promise<SetupPaymentRes> => {
    const customerID = await makeCustomer(data);
    const _data: Omit<typeof data, "successURL"> & {successURL?: string} =
      {...data};
    delete _data.successURL;
    const docData: ApplicationWithCustomer = {
      ..._data, status: "application_with_customer", customerID,
    };
    const doc = await db.donations.add(docData);
    const applicationID = doc.id;
    const setupURL = await createSetupSession(
      customerID, `${data.successURL}/${applicationID}`
    );
    return {setupURL};
  }
);

export const applicationSummary = functions.https.onCall(
  async (data: ApplicationSummaryReq): Promise<ApplicationSummaryRes> => {
    const paymentInfo = processSubscriptionInfo(data);
    return {...data, ...paymentInfo};
  }
);

export const getApplication = functions.https.onCall(
  async (data: GetApplicationReq): Promise<GetApplicationRes> => {
    const doc = await db.donations.doc(data.donationID).get();
    const docData = doc.data();
    if (!docData) throw new Error("Application doesn't exist");
    if (docData.status === "manual") {
      throw new Error("Can't get manual donation");
    }
    const paymentInfo = processSubscriptionInfo(docData);
    return {
      ...docData, ...paymentInfo, status: "application",
    };
  }
);

export const setDefaultPayment = functions.https.onCall(
  async (data: SetDefaultPaymentReq): Promise<SetDefaultPaymentRes> => {
    const doc = await db.donations.doc(data.donationID).get();
    const docData = doc.data();
    if (!docData) throw new Error("Application doesn't exist");
    if (docData.status === "application" || docData.status === "manual") {
      throw new Error("Application doesn't have customerID set");
    }
    await setDefaultPaymentMethod(docData.customerID);
  }
);

export const setupSubscription = functions.https.onCall(
  async (data: SetupSubscriptionReq): Promise<SetupSubscriptionRes> => {
    const doc = db.donations.doc(data.donationID);
    const docData = (await doc.get()).data();
    if (!docData) throw new Error("Application doesn't exist");
    if (docData.status !== "application_with_customer") {
      throw new Error("Application in incorrect state");
    }
    const paymentInfo = processSubscriptionInfo(docData);
    const setupRes =
      await createSubscriptionSchedule(docData, data.donationID);
    const amount = paymentInfo.backPay +
      (paymentInfo.iterations * docData.amount);
    const iftarAmount = !docData.iftarAmount ? undefined :
      paymentInfo.backPayIftars +
      (paymentInfo.iterations * docData.iftarAmount);
    const IDs = await incrementIDsAndPledges(data.donationID, {
      general: true, target: paymentInfo.meetsTarget,
      waseem: docData.promoCode === PromoCode.WASEEM,
    }, {
      general: amount,
      target: paymentInfo.meetsTarget ? amount : 0,
      waseem: docData.promoCode === PromoCode.WASEEM ? amount : 0,
      iftar: iftarAmount,
    });
    const subscription: Subscription = {
      ...docData, status: "subscription", generalID: IDs.general,
      targetID: paymentInfo.meetsTarget ? IDs.target : null,
      waseemID: docData.promoCode === PromoCode.WASEEM ? IDs.waseem : null,
      scheduleID: setupRes.subscriptionScheduleID,
      lumpSum: !setupRes.backpayID ? undefined : {
        amount: paymentInfo.backPay,
        invoiceID: setupRes.backpayID,
        iftarAmount: paymentInfo.backPayIftars,
      },
      created: setupRes.created,
      emailSent: false,
    };
    await doc.set(subscription);
    await sendConfirmationEmail(
      {...subscription, ...paymentInfo}, data.donationID
    );
    subscription.emailSent = true;
    await doc.set(subscription);
    return {...subscription, ...paymentInfo};
  }
);

export const changePaymentMethod = functions.https.onCall(
  async (data: ChangePaymentMethodReq): Promise<ChangePaymentMethodRes> => {
    const donation = (await db.donations.doc(data.donationID).get()).data();
    if (!donation || donation.status !== "subscription") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Donation ID is not for a valid Day By Day subscription",
      );
    }
    const redirectURL =
      await stripeChangePaymentMethod(donation.customerID, data.backURL);
    await sendChangePaymentMethodEmail(
      donation.email,
      data.donationID,
      donation.onBehalfOf,
      redirectURL,
    );
  }
);
