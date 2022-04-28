import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import * as express from 'express';
import * as cors from 'cors';

import { dbKey } from './Tools/databaseKeys';
import { IBeneficiary, iBeneficiaryConverter } from './Classes/Beneficiary.interface';
import { IClassroom, iClassroomConverter } from './Classes/Classroom.interface';
import { provider } from './config/mailProvider';
import emailModel from './Tools/emailModel';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://myappt51.firebaseio.com',
});
export const db = admin.firestore();

/////////////////////////////////API REST
const app = express();
app.use(cors({ origin: true }));
app.use(require('./routes/roomReport.routes'));
exports.app = functions.https.onRequest(app);
////////////////////////////////CLOUD FUNCTIONS

/**
 *  @function onCreateBeneficiary
 *  when ypu create a new beneficiary, classroom object must be uptated
 * the @param attendees list in asyncronus way
 */
exports.onCreateConsolidated = functions.firestore
  .document(`${dbKey.act}/${dbKey.uid}/${dbKey.cvn}/{uuid}`)
  .onCreate(async (snapshot, params) => {
    //intances of beneficiary object ✍
    console.log('new consolidated', params.params.uuid);
    const beneficiary = iBeneficiaryConverter.fromFirestore(snapshot);

    //fetch selected classroom 🎬
    const refRoom = db
      .collection(`${dbKey.act}/${dbKey.uid}/${dbKey.room}`)
      .withConverter(iClassroomConverter)
      .doc(beneficiary.classroom.uuid);
    const query = await refRoom.get();
    const room = query.data();

    //update attendees list 🎭
    if (room !== undefined && room.attendees.indexOf(beneficiary.uuid) === -1) {
      room.attendees.push(beneficiary.uuid);
      //merge object into room ansycronus
      console.log(
        'updated attendees on:',
        room?.idCal,
        ' ✅ new amount: ',
        room?.attendees.length,
        '🆔 uuid:',
        beneficiary.uuid
      );
      const ref = db
        .collection(`${dbKey.act}/${dbKey.uid}/${dbKey.room}`)
        .doc(beneficiary.classroom.uuid);

      //set database
      await ref.set({ attendees: room?.attendees }, { merge: true });
    }

    return true;
  });

/**
 *  @function onCreateSuscription
 *  when ypu create a new beneficiary, classroom object must be uptated
 * the @param enrolled list in asyncronus way
 */
exports.onCreateSuscription = functions.firestore
  .document(`${dbKey.act}/${dbKey.uid}/${dbKey.sus}/{uuid}`)
  .onCreate(async (snapshot, params) => {
    //intance of beneficiary object ✍

    console.log('new suscription', params.params.uuid);
    const beneficiary = iBeneficiaryConverter.fromFirestore(snapshot);

    //fetch selected classroom
    const refRoom = db
      .collection(`${dbKey.act}/${dbKey.uid}/${dbKey.room}`)
      .withConverter(iClassroomConverter)
      .doc(beneficiary.classroom.uuid);
    const query = await refRoom.get();
    const room = query.data();

    //update enrolled list 🎭
    if (room !== undefined && room.enrolled.indexOf(beneficiary.uuid) === -1) {
      room.enrolled.push(beneficiary.uuid);
      //set new list
      console.log(
        'updated enrolled on',
        room?.idCal,
        ' ✅ new amount: ',
        room?.enrolled.length,
        '🆔 uuid:',
        beneficiary.uuid
      );

      const docRoom = db
        .collection(`${dbKey.act}/${dbKey.uid}/${dbKey.room}`)
        .doc(beneficiary.classroom.uuid);

      await docRoom.set({ enrolled: room?.enrolled }, { merge: true });
    }
    await mailer(room, beneficiary);

    return true;
  });

require('dotenv').config({
  path: '.env.production',
});

/**
 * @function mailer nodemailer services to send basic
 * information of activities to suscribed users.
 */
export async function mailer(room: IClassroom | undefined, benf: IBeneficiary) {
  const prov = provider(process.env.EMAIL_USER, process.env.EMAIL_PASS);
  let transporter = nodemailer.createTransport(prov);

  try {
    let info = await transporter.sendMail({
      from: `"Equipo Con Buena Energía 💚" <${prov.auth.user}>`, // sender address
      to: benf.email, // list of receivers
      subject: 'Inscripción Con Buena Energía', // Subject line
      html: emailModel(room, benf), // html body
    });
    console.log('mailer', info.accepted);
  } catch (error) {
    console.log('mailer', error);
  }
}

export { functions as firebase };
