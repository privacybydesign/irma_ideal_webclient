var MESSAGES = {
    'lang': 'nl',
    'api-fail': 'Kan geen verbinding maken met de backend server',
    'unknown-error': 'Onbekende fout',
    'start-ideal-transaction': 'iDeal-transaction aan het starten...',
    'redirect-to-ideal-bank': 'U wordt doorgestuurd naar uw iDeal bank...',
    'loading-return': 'Communiceren met de bank..',
    'ideal-no-transaction': 'Geen iDeal-transactie meer actief.',
    'ideal-transaction-not-found': 'De opgevraagde iDeal-transactie kon niet gevonden worden. Mogelijk is de sessie verlopen.',
    'issuing-ideal-credential': 'Uitgeven iDeal-attributen...',
    'failed-to-verify-ideal': 'iDeal-transactie kon niet worden geverifieerd',
    'failed-to-issue-ideal': 'iDeal-attributen konden niet worden uitgegeven.',
    'issue-success': 'Uitgifte iDeal attributen succesvol!',
    'error:transaction-cancelled': 'Transactie geannuleerd.',
    'error:transaction-open': 'Uw bank heeft de transactie nog niet verwerkt. Controleer de status opnieuw over 24 uur op hetzelfde apparaat dat u nu gebruikt. Zolang je geen nieuwe uitgiftesessie start voor iDeal-attributen in IRMA, blijft de huidige transactie actief zonder dat u opnieuw hoeft te betalen.',
    'error:transaction-expired': 'De sessie bij uw bank is verlopen. Helaas kunnen wij uw gegevens daardoor niet meer ophalen.',
    'ideal-status:other': 'Onbekende fout in de iDeal-transactie.',
    'ideal-status:consumermsg': 'De volgende fout is opgetreden in de iDeal-transactie:',
    'ideal-minimum-amount': (amount) => '\u20ac ' + amount + ' (minimumbedrag)',
    'ideal-donation-amount': (amount, donation) => '\u20ac ' + amount + ' (waarvan \u20ac ' + donation + ' donatie)',
};
