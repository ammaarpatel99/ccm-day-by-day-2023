import {initializeApp} from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  DocumentReference,
  FirestoreDataConverter,
} from "firebase-admin/firestore";

export interface BaseSubscription {
  name: string;
  wantsBrick: boolean;
  eligibleForBrick: boolean;
  anonymous: boolean;
  email: string;
  phone: string;
  giftAid: boolean;
  amount: number;
  iterations: number;
  startDate: Timestamp;
  customerID: string;
}

export interface ActiveSubscription extends BaseSubscription {
  scheduleID: string;
  subscriptionID: string;
  created: Timestamp;
  confirmationEmail: DocumentReference;
}

type Subscription = BaseSubscription | ActiveSubscription;

interface Email {
  to: string;
  message: {
    subject: string;
    html: string;
  }
}

const app = initializeApp();
const firestore = getFirestore(app);

const subscriptionConverter: FirestoreDataConverter<Subscription> = {
  toFirestore(modelObject: Subscription): FirebaseFirestore.DocumentData {
    return modelObject;
  },
  fromFirestore(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot
  ): Subscription {
    return snapshot.data() as Subscription;
  },
};

const mailConverter: FirestoreDataConverter<Email> = {
  toFirestore(modelObject: Email): FirebaseFirestore.DocumentData {
    return modelObject;
  },
  fromFirestore(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot
  ): Email {
    return snapshot.data() as Email;
  },
};

export const db = {
  subscriptions: firestore.collection("subscriptions")
    .withConverter(subscriptionConverter),
  mail: firestore.collection("mail")
    .withConverter(mailConverter),
};