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
    $('#btn-ideal-logout-confirm').click(deleteIDealTransaction);
    $('#btn-ideal-logout').click(() => {
        // If the user is not able to retry the session at all,
        // then we also don't have to shown the logout warning.
        if ($('#pane-ideal-result-retry').hasClass('hidden') && $('#pane-ideal-result-ok').hasClass('hidden')) {
            deleteIDealTransaction();
            return;
        }
        if ($('#pane-ideal-result-open').hasClass('hidden')) {
            $('#text-ideal-logout-confirm-nolink').removeClass('hidden');
        } else {
            $('#text-ideal-logout-confirm-link').removeClass('hidden');
        }
        $('#pane-ideal-logout-confirm').removeClass('hidden');
        $('#pane-ideal-result').addClass('hidden');
    });
    $('#btn-ideal-logout-cancel').click(() => {
        $('#pane-ideal-logout-confirm').addClass('hidden');
        $('#pane-ideal-result').removeClass('hidden');
        $('#text-ideal-logout-confirm-nolink').addClass('hidden');
        $('#text-ideal-logout-confirm-link').addClass('hidden');
    });

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
    $('#pane-ideal-result-open').addClass('hidden');
    $('#pane-ideal-result-retry').addClass('hidden');
    $('#pane-ideal-result-logout').addClass('hidden');
    $('#pane-ideal-logout-confirm').addClass('hidden');
    $('#text-ideal-logout-confirm-nolink').addClass('hidden');
    $('#text-ideal-logout-confirm-link').addClass('hidden');
    $(document.body).attr('class', 'phase' + num);
    const params = parseURLParams();
    if (num === 1) {
        loadIDealInfo();
        $('#transaction-alert').addClass('hidden'); // set default back
        if (localStorage.idx_ideal_trxid) {
            // A session is in progress, offer to issue.
            $('#transaction-alert').removeClass('hidden');
            $('#transaction-alert-link').attr('href', '?trxid=' + localStorage.idx_ideal_trxid + '&ec=' + localStorage.idx_ideal_ec);
        }
    } else if (num === 2) {
        if (params.trxid) {
            localStorage.idx_ideal_link = location.href;
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
    setStatus('cancel');

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
        irma.newPopup({
            language: MESSAGES['lang'],
            session: {
                start: false,
                mapping: {
                    sessionPtr: () => response.sessionPointer,
                },
                result: false,
            },
        })
            .start()
            .then(function(e) {
                console.log('iDeal credential issued:', e);
                setStatus('success', MESSAGES['issue-success']);
            }, function(e) {
                if(['Cancelled', 'Aborted'].includes(e)) {
                    console.warn('cancelled:', e);
                    setStatus('cancel');
                } else {
                    console.error('issue failed:', e);
                    setStatus('danger', MESSAGES['failed-to-issue-ideal'], e);
                }
            })
            .finally(function() {
                localStorage.idx_ideal_response = 'success';
                $('#pane-ideal-result-ok').removeClass('hidden');
                $('#pane-ideal-result-logout').removeClass('hidden');
            });
    }).fail(function(xhr) {
        $('#pane-ideal-result-logout').removeClass('hidden');

        $('#btn-ideal-retry').click(() => {
            location.href = localStorage.idx_ideal_link;
        });

        // In case of a rate limiting warning, fallback on the previous error.
        if (xhr.status === 429) {
            let seconds = parseInt(xhr.getResponseHeader('Retry-After'));
            setStatus('warning', MESSAGES['ideal-status:too-many-requests'](Math.ceil(seconds/60)));
            $('#pane-ideal-result-retry').removeClass('hidden');
            if (localStorage.idx_ideal_response === 'error:transaction-open') {
                $('#ideal-retry-link')
                  .attr('href', localStorage.idx_ideal_link)
                  .html(localStorage.idx_ideal_link);
                $('#pane-ideal-result-open').removeClass('hidden');
            }
            return;
        }

        localStorage.idx_ideal_response = xhr.responseText;
        if (xhr.responseText === 'error:transaction-open') {
            setStatus('cancel');
            $('#ideal-retry-link')
              .attr('href', localStorage.idx_ideal_link)
              .html(localStorage.idx_ideal_link);
            $('#pane-ideal-result-open').removeClass('hidden');
            $('#pane-ideal-result-retry').removeClass('hidden');
        } else if (xhr.status === 500 && xhr.responseText in MESSAGES) {
            setStatus('warning', MESSAGES[xhr.responseText]);
        } else if (xhr.status === 404 && xhr.responseText.substr(0, 21) === 'error:trxid-not-found') {
            setStatus('warning', MESSAGES['ideal-transaction-not-found']);
        } else {
            setStatus('danger', MESSAGES['ideal-status:other'], xhr);
            $('#pane-ideal-result-retry').removeClass('hidden');
            console.error('failed to finish iDeal transaction:', xhr.responseText);
        }
    });
}

function deleteIDealTransaction() {
    if (['success', 'error:transaction-cancelled', 'error:transaction-expired'].includes(localStorage.idx_ideal_response)) {
        $.ajax({
            method: 'POST',
            url: config.ideal_api_url + 'delete',
            data: {
                trxid: localStorage.idx_ideal_trxid,
                ec: localStorage.idx_ideal_ec,
            },
        });
    }
    delete localStorage.idx_ideal_trxid; // not valid anymore
    delete localStorage.idx_ideal_ec;
    delete localStorage.idx_ideal_response;

    loadIDealInfo();
    setStatus('cancel');
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

    const alert = $('#status-bar');
    if (alertType === 'cancel') {
        alert.addClass('hidden');
        return;
    }

    const statusElement = $('#status');
    statusElement.html(message);
    if (errormsg) {
        statusElement.append('<br>');
        statusElement.append($('<small></small>').text(errormsg));
    }

    alert
      .removeClass('alert-success')
      .removeClass('alert-info')
      .removeClass('alert-warning')
      .removeClass('alert-danger')
      .addClass('alert-'+alertType)
      .removeClass('hidden');
    window.scrollTo(0,0);
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
