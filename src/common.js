'use strict';

let iDealInfoLoaded = false;

// Hack to get the clicked button, with browser-based form validation.
// Apparently there is no way to get the clicked button that also works on OS X
// (Safari and Firefox).
// https://stackoverflow.com/questions/5721724/jquery-how-to-get-which-button-was-clicked-upon-form-submission
let clickedButton = null;

function init() {
    $('#form-ideal-request').submit(function(e) {
        startIDealTransaction(e);
    });
    $('#btn-ideal-request').click(function(e) {
        clickedButton = e.target;
    });
    $('#btn-ideal-issue').click(finishIDealTransaction);
    $('#btn-ideal-retry').click(retryIDealTransaction);

    updatePhase();
}

function updatePhase() {
    let params = parseURLParams();
    if (params.ec) {
        // phase 2: get the result and issue the iDeal credential
        setPhase(2);
    } else {
        // phase 1: input iDeal bank to redirect to it
        setPhase(1);
    }
}

function setPhase(num) {
    $('#pane-ideal-result-ok').addClass('hidden');
    $('#pane-ideal-result-fail').addClass('hidden');
    $(document.body).attr('class', 'phase' + num);
    const params = parseURLParams();
    if (num === 1) {
        loadIDealInfo();
        $('#transaction-alert').hide(); // set default back
        if (localStorage.idx_ideal_trxid) {
            // A session is in progress, offer to issue.
            $('#transaction-alert').show();
            $('#transaction-alert a').attr('href', '?trxid=' + localStorage.idx_ideal_trxid + '&ec=' + localStorage.idx_ideal_ec);
        }
    } else if (num === 2) {
        if (params.trxid) {
            localStorage.idx_ideal_trxid = params.trxid;
            localStorage.idx_ideal_ec = params.ec;
            // trxid and ec are now saved, drop it from the URL
            history.replaceState(null, '', '?');
        }
        finishIDealTransaction();
    }
}

function loadIDealInfo() {
    if (iDealInfoLoaded) {
        return;
    }
    iDealInfoLoaded = true;
    const selectBank = $('#input-ideal-bank');
    $.ajax({
        url: config.ideal_api_url + 'banks',
    }).done(function(data) {
        insertBanksIntoForm(data, selectBank);
    }).fail(function() {
        // TODO: show error on top? i18n?
        selectBank.empty();
        selectBank.append($('<option selected disabled hidden>Failed to load bank list</option>'));
    });

    const selectAmount = $('#input-amount');
    $.ajax({
        url: config.ideal_api_url + 'amounts',
    }).done(function(data) {
        insertAmountsIntoForm(data, selectAmount);
    }).fail(function() {
        // TODO: show error on top? i18n?
        selectAmount.empty();
        selectAmount.append($('<option selected disabled hidden>Failed to load amounts list</option>'));
    });
}

function insertAmountsIntoForm(data, select) {
    // clear existing data ('Loading...')
    select.empty();

    // Load all amounts and make sure they are sorted
    const amounts = data.map(a => parseFloat(a).toFixed(2));
    amounts.sort(function(a,b) { return a - b;});

    // Add default amount
    const defaultOption = $('<option selected>');
    const minimumAmount = amounts[0];
    defaultOption.text(MESSAGES['ideal-minimum-amount'](minimumAmount));
    defaultOption.val(minimumAmount);
    select.append(defaultOption);

    // Insert other amounts (if present)
    for (let i=1; i < amounts.length; i++) {
        const option = $('<option>');
        const donationAmount = amounts[i] - minimumAmount;
        option.text(MESSAGES['ideal-donation-amount'](amounts[i], donationAmount.toFixed(2)));
        option.val(amounts[i]);
        select.append(option);
    }
}

function insertBanksIntoForm(data, select) {
    // clear existing data ('Loading...')
    select.empty();
    select.append($('<option selected disabled hidden>'));

    // create a list of countries
    const countries = [];
    for (let country in data) {
        countries.push(country);
    }
    countries.sort();
    if (countries.indexOf('Nederland') >= 0) {
        // set Nederland as first country
        countries.splice(countries.indexOf('Nederland'), 1);
        countries.unshift('Nederland');
    }

    // insert each country with it's banks
    for (let country of countries) {
        const optgroup = $('<optgroup>');
        optgroup.attr('label', country);
        select.append(optgroup);
        for (let bank of data[country]) {
            const option = $('<option>');
            option.text(bank.issuerName);
            option.val(bank.issuerID);
            optgroup.append(option);
        }
    }

    select.val(sessionStorage.idx_selectedBank);
}

// With the name and email, start a transaction.
function startIDealTransaction(e) {
    e.preventDefault();
    setStatus('info', MESSAGES['start-ideal-transaction']);
    $('#btn-ideal-request').prop('disabled', true);
    $('#result-alert').hide();

    const selectedBank = $('#input-ideal-bank').val();
    const selectedAmount = $('#input-amount').val();
    sessionStorage.idx_selectedBank = selectedBank;
    const data = {
        bank: selectedBank,
        amount: selectedAmount,
    };
    $.ajax({
        method: 'POST',
        url:    config.ideal_api_url + 'start',
        data:   data,
    }).done(function(data) {
        setStatus('info', MESSAGES['redirect-to-ideal-bank']);
        location.href = data;
    }).fail(function(xhr) {
        setStatus('danger', MESSAGES['api-fail'], xhr);
        $('#btn-ideal-request').prop('disabled', false);
    });
}

function finishIDealTransaction() {
    if (!('idx_ideal_trxid' in localStorage)) {
        setStatus('warning', MESSAGES['ideal-no-transaction']);
        return;
    }
    setStatus('info', MESSAGES['loading-return']);
    $.ajax({
        method: 'POST',
        url: config.ideal_api_url + 'return',
        data: {
            trxid: localStorage.idx_ideal_trxid,
            ec: localStorage.idx_ideal_ec,
        },
    }).done(function(response) {
        setStatus('info', MESSAGES['issuing-ideal-credential']);
        console.log('issuing session pointer:', response.sessionPointer);
        irma.handleSession(response.sessionPointer, {language: MESSAGES['lang']})
            .then(function(e) {
                delete localStorage.idx_ideal_trxid; // no longer needed
                delete localStorage.idx_ideal_ec;
                console.log('iDeal credential issued:', e);
                setStatus('success', MESSAGES['issue-success']);
                $('#btn-ideal-issue').hide();
            }, function(e) {
                if(e === 'CANCELLED') {
                    console.warn('cancelled:', e);
                    setStatus('cancel');
                } else {
                    console.error('issue failed:', e);
                    setStatus('danger', MESSAGES['failed-to-issue-ideal'], e);
                }
            })
            .finally(function() {
                $('#pane-ideal-result-ok').removeClass('hidden');
                $('#pane-ideal-result-fail').removeClass('hidden');
            });
    }).fail(function(xhr) {
        $('#pane-ideal-result-fail').removeClass('hidden');
        delete localStorage.idx_ideal_trxid; // not valid anymore
        delete localStorage.idx_ideal_ec;
        if (xhr.status === 500 && xhr.responseText in MESSAGES) {
            setStatus('warning', MESSAGES[xhr.responseText]);
        } else if (xhr.status === 404 && xhr.responseText.substr(0, 21) === 'error:trxid-not-found') {
            setStatus('warning', MESSAGES['ideal-transaction-not-found']);
        } else {
            setStatus('danger', MESSAGES['ideal-status:other'], xhr);
            console.error('failed to finish iDeal transaction:', xhr.responseText);
        }
    });
}

function retryIDealTransaction() {
    loadIDealInfo();
    $('#result-alert').hide();
    setPhase(1);
    history.pushState(null, '', '?');
}

// Show progress in the alert box.
function setStatus(alertType, message, errormsg) {
    console.log('user message: ' + alertType + ': ' + message);
    message = message || MESSAGES['unknown-error']; // make sure it's not undefined
    if (errormsg && errormsg.statusText) { // is this an XMLHttpRequest?
        errormsg = errormsg.status + ' ' + errormsg.statusText;
    }

    const alert = $('#result-alert');
    if (alertType === 'cancel') {
        alert.hide();
        return;
    }
    alert.show();
    alert.attr('class', 'alert alert-' + alertType);
    alert.text(message);
    if (errormsg) {
        alert.append('<br>');
        alert.append($('<small></small>').text(errormsg));
    }
}

// https://stackoverflow.com/a/8486188/559350
function parseURLParams() {
    const query = location.search.substr(1);
    const result = {};
    query.split("&").forEach(function(part) {
        const item = part.split("=");
        result[item[0]] = decodeURIComponent(item[1]);
    });
    return result;
}

init(); // script is deferred so DOM has been built
