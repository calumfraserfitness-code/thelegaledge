/* Reviewable document examples, never substituted for an enrolled client's signed snapshot. */
const legalEdgeDraftAgreement=`LEGAL EDGE COACHING AGREEMENT
Draft for Calum’s review • 5 October 2026

1. Your coaching
Calum Fraser, trading as Calum Fraser Fitness / Legal Edge Coaching in Ireland, provides individual exercise, nutrition, routine and accountability coaching. Your selected offer or firm-funded invitation sets the programme length, fee, payment schedule and included calls. Those details must be confirmed in your enrollment before this agreement is used.

2. Your programme
Your coach reviews your profile before publishing your plan and adjusts recommendations through check-ins. Coaching supports your goals but does not guarantee a particular weight, appearance, performance or medical outcome. Materials are for your personal use.

3. Health and safety
Coaching is not medical diagnosis, treatment, emergency care or a substitute for advice from a qualified healthcare professional. Tell your coach about relevant conditions, medication, injuries, pregnancy and changes to your health. Follow clinical restrictions. Stop an activity if it causes concerning symptoms and seek appropriate medical assistance; do not wait for an app response in an emergency. Your coach may pause an activity or ask for clinical clearance where appropriate.

4. Your responsibilities
Provide accurate information, use suitable equipment and exercise within your abilities. Keep your login private. Contact your coach when a recommendation does not fit your circumstances rather than attempting an unsafe activity. Neither accepting this agreement nor taking part removes your statutory rights or excuses negligent service.

5. Payments, cancellation and complaints
Personal clients pay under their confirmed offer. Firm-funded employees do not pay personally unless a separate arrangement is expressly agreed. Fees, cancellation, refunds, rescheduling and any applicable cooling-off rights must be stated in the offer-specific terms before signing. Contact Calum through your established coaching contact if there is a service concern. This draft does not impose a no-refund rule or waive consumer rights.

6. Privacy and optional sharing
Read the separate privacy notice before sharing health information. Device access, employer reporting, marketing and testimonials are separate choices. Your employer does not receive your individual check-in answers, private audio, health records, measurements or meal plan through the employer dashboard. Group reporting requires its own consent process.

7. Electronic signature and records
Your typed name and affirmative agreement record your electronic acceptance. A versioned copy remains accessible in your account and to your assigned coach. Email delivery of signed copies is not currently enabled.

REVIEW BEFORE LIVE USE
Confirm the business contact, offer-specific scope and cancellation/refund terms, applicable consumer rights, insurance alignment and dispute arrangements. This draft is not an approved client contract.`;
const legalEdgeDraftPrivacy=`LEGAL EDGE COACHING PRIVACY NOTICE
Draft for Calum’s review • 5 October 2026

WHO IS RESPONSIBLE
Calum Fraser, trading as Calum Fraser Fitness / Legal Edge Coaching in Ireland, is the proposed controller for this coaching account. Contact Calum through your established coaching contact or the contact route at www.thelegal-edge.com. A dedicated privacy email and business correspondence address must be confirmed before publishing this notice.

WHAT WE COLLECT
Account and contact details; your agreement and consent records; coaching goals; training and nutrition background; relevant health restrictions; check-ins and progress entries; and optional photos, voice check-ins, lab reports or readings you choose to share. Connected readings are limited to the categories you approve, such as steps, sleep, weight, resting heart rate, workouts or nutrition totals. We do not request your watch-account password or routine copies of identity documents.

WHY WE USE IT
To create and manage your account, deliver and adjust coaching, respond to check-ins, maintain consent and service records, administer payment and protect the app. Coaching is reviewed by a person. No solely automated decision about employment is made through this coaching service.

LAWFUL BASES
The proposed Article 6 bases are performance of the coaching contract for service administration, legal obligations for records where applicable, and legitimate interests for proportionate account security. Firm-funded enrollment needs the applicable service basis documented. Health information is special-category data: explicit consent is requested separately for the specified coaching purposes under Article 9(2)(a). Optional device sharing and employer reporting require separate choices. These bases and purposes need to be confirmed before live publication.

WHO CAN ACCESS YOUR INFORMATION
You and your assigned coach access your private coaching records. The app uses Supabase for its database, authentication and private storage, and Vercel for hosting. Payment providers process payment information under their own notices; full card details are not stored in your coaching profile. Optional device exporters or connected apps act under their own permissions and notices. Additional processors, support access and contracts must be verified before this notice is approved.

FIRM-FUNDED CLIENTS
The employer dashboard is intended for consented group reporting. Your individual health readings, body weight, private audio, check-in answers and personal plans are not displayed to your employer. Group reporting is optional and separate from the health-consent checkbox. Small-group reporting rules and the exact measures shared must be explained before asking for that separate consent.

STORAGE AND INTERNATIONAL ACCESS
The app’s Supabase project is in the EU. EU database location does not mean every hosting, support or subprocesser operation stays in the EU. Provider processing locations, agreements and any required transfer safeguards must be checked and identified in the published notice. Do not upload genetic or laboratory reports until the relevant purpose and access arrangements have been explained.

HOW LONG WE KEEP DATA
A documented retention schedule is required before publication. Proposed review periods are deletion or anonymisation of routine coaching health records within 12 months of the coaching relationship ending, and retention of necessary agreement, payment or dispute records only for applicable legal periods. These are proposed limits, not a claim that automated deletion is already implemented. Record-specific exceptions and backup deletion timing must be confirmed.

YOUR CHOICES AND RIGHTS
You may request access, correction, deletion, restriction or portability where applicable, and object where processing relies on legitimate interests. Withdraw consent by contacting Calum; disconnect devices in Connections to stop new uploads. Disconnecting a device does not itself delete existing records. Withdrawal does not affect lawful processing before withdrawal; health-dependent coaching may need to pause or change if necessary information can no longer be used. Optional sharing does not authorise marketing, publication of photos or employer access.

QUESTIONS OR COMPLAINTS
Contact Calum first if you want to exercise a right or raise a concern. You may complain to Ireland’s Data Protection Commission at www.dataprotection.ie, or your relevant supervisory authority. This draft does not waive rights available to clients in other jurisdictions.

REVIEW BEFORE LIVE USE
Confirm the controller contact, actual processing bases, processor list, transfer safeguards, retention/deletion process and employer reporting terms. This is a review draft and is not used automatically for real enrollments.`;
document.addEventListener('DOMContentLoaded',()=>{
 if(journeyDemo&&journeyCurrent){journeyCurrent.contract_title='Legal Edge Coaching Agreement · review draft';journeyCurrent.contract_version='DRAFT-2026-10-05';journeyCurrent.contract_body=legalEdgeDraftAgreement;journeyCurrent.privacy_version='DRAFT-2026-10-05';journeyCurrent.privacy_body=legalEdgeDraftPrivacy;const step=new URLSearchParams(location.search).get('step');if(step==='agreement'||step==='privacy'){journeyCurrent.stage='contract';if(step==='privacy'){journeyCurrent.signed_at=new Date().toISOString();journeyCurrent.signature_name='Preview Client';}renderJourney(journeyCurrent);}}
});
