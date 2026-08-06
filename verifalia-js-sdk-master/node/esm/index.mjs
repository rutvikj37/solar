// (c) Verifalia - email verification service - https://verifalia.com
import { __awaiter } from 'tslib';
import 'debug';
import { L as Logger, a as submitEmailValidationFile, s as submitEmailValidation, g as getEmailValidation, d as deleteEmailValidation, l as listEmailValidations, e as exportEmailValidationEntries, V as VerifaliaError, O as OperationCanceledError } from './index-95e3c13c.mjs';
export { O as OperationCanceledError, V as VerifaliaError, W as WaitOptions, d as deleteEmailValidation, e as exportEmailValidationEntries, g as getEmailValidation, l as listEmailValidations, s as submitEmailValidation, a as submitEmailValidationFile } from './index-95e3c13c.mjs';
export { CaptchaProvider_HCaptcha, CaptchaProvider_ReCaptchaV2, CaptchaProvider_ReCaptchaV3, CaptchaProvider_Turnstile, DeduplicationMode_Off, DeduplicationMode_Relaxed, DeduplicationMode_Safe, QualityLevelName_Extreme, QualityLevelName_High, QualityLevelName_Standard, ValidationEntryClassification_Deliverable, ValidationEntryClassification_Risky, ValidationEntryClassification_Undeliverable, ValidationEntryClassification_Unknown, ValidationEntryStatus_AtSignNotFound, ValidationEntryStatus_CatchAllConnectionFailure, ValidationEntryStatus_CatchAllValidationTimeout, ValidationEntryStatus_DnsConnectionFailure, ValidationEntryStatus_DnsQueryTimeout, ValidationEntryStatus_DomainDoesNotExist, ValidationEntryStatus_DomainHasNullMx, ValidationEntryStatus_DomainIsMisconfigured, ValidationEntryStatus_DomainIsWellKnownDea, ValidationEntryStatus_DomainPartCompliancyFailure, ValidationEntryStatus_DoubleDotSequence, ValidationEntryStatus_Duplicate, ValidationEntryStatus_InvalidAddressLength, ValidationEntryStatus_InvalidCharacterInSequence, ValidationEntryStatus_InvalidEmptyQuotedWord, ValidationEntryStatus_InvalidFoldingWhiteSpaceSequence, ValidationEntryStatus_InvalidLocalPartLength, ValidationEntryStatus_InvalidWordBoundaryStart, ValidationEntryStatus_IspSpecificSyntaxFailure, ValidationEntryStatus_LocalEndPointRejected, ValidationEntryStatus_LocalPartIsWellKnownRoleAccount, ValidationEntryStatus_LocalSenderAddressRejected, ValidationEntryStatus_MailExchangerIsHoneypot, ValidationEntryStatus_MailExchangerIsParked, ValidationEntryStatus_MailExchangerIsWellKnownDea, ValidationEntryStatus_MailboxConnectionFailure, ValidationEntryStatus_MailboxDoesNotExist, ValidationEntryStatus_MailboxIsDea, ValidationEntryStatus_MailboxTemporarilyUnavailable, ValidationEntryStatus_MailboxValidationTimeout, ValidationEntryStatus_OverrideMatch, ValidationEntryStatus_ServerDoesNotSupportInternationalMailboxes, ValidationEntryStatus_ServerIsCatchAll, ValidationEntryStatus_ServerTemporaryUnavailable, ValidationEntryStatus_SmtpConnectionFailure, ValidationEntryStatus_SmtpConnectionTimeout, ValidationEntryStatus_SmtpDialogError, ValidationEntryStatus_Success, ValidationEntryStatus_UnacceptableDomainLiteral, ValidationEntryStatus_UnbalancedCommentParenthesis, ValidationEntryStatus_UnexpectedQuotedPairSequence, ValidationEntryStatus_UnhandledException, ValidationEntryStatus_UnmatchedQuotedPair, ValidationPriority_Highest, ValidationPriority_Lowest, ValidationPriority_Normal, ValidationStatus_Completed, ValidationStatus_Deleted, ValidationStatus_Expired, ValidationStatus_InProgress } from './email-validations/constants.mjs';
import { R as RestRequest } from './RestRequest-9419b849.mjs';
import 'fs';
import FormData from 'form-data';
import { getCreditsBalance, listCreditsDailyUsages } from './credits/functions.mjs';
export { getCreditsBalance, listCreditsDailyUsages } from './credits/functions.mjs';
import { Agent } from 'https';

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
const logger = new Logger('verifalia');
class EmailValidationsRestClient {
    constructor(restClientFactory) {
        this._restClientFactory = restClientFactory;
    }
    /**
     * Submits one or more email addresses for validation.
     *
     * This method accepts a wide range of input types, including:
     * - `string` and `string[]`, useful to submit only the email address(es) to verify, using the default
     * processing options;
     * - `ValidationRequestEntry` and `ValidationRequestEntry[]`, allowing to specify an optional custom
     * string (such as a customer ID) along with each email address under test;
     * - `ValidationRequest`, used to fully customize the email verification process;
     * - `FileValidationRequest`, used to import and verify files containing lists of email addresses.
     *
     * By default, this method waits for the completion of the email validation job: pass a `WaitOptions`
     * to request a different waiting behavior.
     *
     * This method returns a `Promise` which can be consumed using the async/await pattern (or through the
     * classic `then()` / `catch()` functions) and can be cancelled through a `CancellationToken`.
     *
     * ## How to verify an email address
     *
     * Here is the simplest case, showing how to verify a single email address, using the default processing
     * options:
     *
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     *
     * const result = await verifalia
     *     .emailValidations
     *     .submit('batman@gmail.com');
     *
     * console.log(result.entries[0].classification); // 'Deliverable'
     * ```
     * It is also possible to pass a `ValidationRequest` to specify any supported processing option, including the
     * desired result quality level and data retention policy:
     *
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     *
     * const result = await verifalia
     *     .emailValidations
     *     .submit({
     *         entries: [
     *             {
     *                 inputData: 'scottgu@gmail.com',
     *                 // custom: 'foobar123'
     *             }
     *         ],
     *         quality: 'High',
     *         retention: '0:5:0' // 5 minutes
     *     });
     *
     * console.log(result.entries[0].classification); // 'Deliverable'
     * ```
     *
     * ## How to verify multiple email addresses at once
     *
     * To validate multiple email addresses at once, just submit an array of strings:
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     *
     * const result = await verifalia
     *     .emailValidations
     *     .submit([ 'batman@gmail.com', 'robin1940@yahoo.com' ]);
     *
     * result.entries.forEach((item) => {
     *     console.log(`${item.inputData}: ${item.classification}`);
     * }); // 'batman@gmail.com: Deliverable' 'robin1940@yahoo.com: Undeliverable'
     * ```
     *
     * As seen in the section above, it is also possible to pass a `ValidationRequest` to specify
     * any supported processing option, including the desired result quality level and data retention
     * policy:
     *
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     *
     * const result = await verifalia
     *     .emailValidations
     *     .submit({
     *         entries: [
     *             {
     *                 inputData: 'scottgu@gmail.com',
     *                 // custom: 'foobar'
     *             },
     *             {
     *                 inputData: 'robin1940@yahoo.com',
     *                 // custom: '42'
     *             },
     *         ],
     *         quality: 'Extreme',
     *         retention: '1:30:0' // 1 hour and 30 minutes
     *     });
     *
     * result.entries.forEach((item) => {
     *     console.log(`${item.inputData}: ${item.classification}`);
     * }); // 'batman@gmail.com: Deliverable' 'robin1940@yahoo.com: Undeliverable'
     * ```
     *
     * ## Import and verify a list of email addresses
     *
     * To import and submit a file with the email addresses to verify, pass a `FileValidationRequest`
     * to this method, with the `file` field assigned to an instance of one of these supported types:
     * - `ReadStream` or a `Buffer` (Node.js), or;
     * - `Blob` or a `File` (browser).
     *
     * Here is how to import and verify a list in the CSV file format, in Node.js, using a `ReadStream`:
     * ```ts
     * const fs = require('fs');
     *
     * const verifalia = new VerifaliaRestClient(...);
     * const fileStream = fs.createReadStream('./my-list.csv');
     *
     * const result = await verifalia
     *     .emailValidations
     *     .submit({
     *         file: fileStream,
     *         contentType: 'text/csv',
     *         column: 0,
     *         startingRow: 1
     *     });
     *
     * result.entries.forEach((item) => {
     *     console.log(`${item.inputData}: ${item.classification}`);
     * });
     * ```
     *
     * While importing and submitting a file for email verification, it is possible to specify any processing
     * option through the passed `FileValidationRequest` instance, similarly to how one can do that with the
     * `ValidationRequest` class.
     *
     * ```ts
     * const fs = require('fs');
     *
     * const verifalia = new VerifaliaRestClient(...);
     * const fileStream = fs.createReadStream('./my-list.csv');
     *
     * const result = await verifalia
     *     .emailValidations
     *     .submit({
     *         file: fileStream,
     *         contentType: 'text/csv',
     *         column: 0,
     *         startingRow: 1,
     *         quality: 'High',
     *         retention: '0:10:0', // 10 minutes
     *         callback: {
     *             url: 'https://your-website-here/foo/bar'
     *         }
     *     });
     *
     * result.entries.forEach((item) => {
     *     console.log(`${item.inputData}: ${item.classification}`);
     * });
     * ```
     *
     * ## Custom waiting
     *
     * As mentioned, `submit()` automatically waits for the completion of the submitted email
     * verification job. It is however possible, through the `waitOptions` parameter, to customize
     * the waiting behavior of the method.
     *
     * Here is how, for instance, one can enqueue a possibly large email verification job, **without**
     * waiting for its completion:
     *
     * ```ts
     * const job = await verifalia
     *     .emailValidations
     *     .submit(TODO, WaitOptions.noWait);
     *
     * console.log(`${job.overview.status}`); // InProgress
     * ```
     *
     * And here is how to **track the progress** of an email verification job through a custom `WaitOptions` and
     * a `progress` function lambda:
     *
     * ```ts
     * const job = await verifalia
     *     .emailValidations
     *     .submit(TODO,
     *         {
     *             ...new WaitOptions(),
     *             progress: jobOverview => {
     *                 console.log(`% completed: ${jobOverview.progress?.percentage * 100}`);
     *             }
     *         });
     * ```
     *
     * @param request An object with one or more email addresses to validate. Can be of type `string`, `string[]`,
     * `ValidationRequestEntry`, `ValidationRequestEntry[]`, `ValidationRequest`, `FileValidationRequest`.
     * @param waitOptions Optional configuration settings for waiting on the completion of an email validation job.
     * Can be `undefined` (or `null`) to wait for the completion using the default settings, `WaitOptions.noWait` to
     * avoid waiting or an instance of `WaitOptions` for advanced scenarios and progress tracking.
     */
    submit(request, waitOptions, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.log('submitting', request, waitOptions);
            // Use the "file" field as a discriminator to detect whether the argument is a FileValidationRequest
            // or not.
            if (request.file) {
                return submitEmailValidationFile(this._restClientFactory, request, waitOptions, cancellationToken);
            }
            return submitEmailValidation(this._restClientFactory, request, waitOptions, cancellationToken);
        });
    }
    /**
     * Returns an email validation job previously submitted for processing.
     *
     * By default, this method waits for the completion of the email validation job: pass a `WaitOptions`
     * to request a different waiting behavior.
     *
     * This method returns a `Promise` which can be consumed using the async/await pattern (or through the
     * classic `then()` / `catch()` functions) and can be cancelled through a `CancellationToken`.
     *
     * Here is how to retrieve an email validation job, given its ID:
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     * await verifalia
     *     .emailValidations
     *     .get('JOB-ID-HERE'); // validation.id (returned by submit() or list())
     * ```
     *
     * @param id The ID of the email validation job to retrieve.
     * @param waitOptions Optional configuration settings for waiting on the completion of an email validation job.
     * Can be `undefined` (or `null`) to wait for the completion using the default settings, `WaitOptions.noWait` to
     * avoid waiting or an instance of `WaitOptions` for advanced scenarios and progress tracking.
     */
    get(id, waitOptions, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            return getEmailValidation(this._restClientFactory, id, waitOptions, cancellationToken);
        });
    }
    /**
     * Deletes an email validation job previously submitted for processing.
     *
     * This method returns a `Promise` which can be consumed using the async/await pattern (or through the
     * classic `then()` / `catch()` functions) and can be cancelled through a `CancellationToken`.
     *
     * Here is how to delete an email validation job:
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     * await verifalia
     *     .emailValidations
     *     .delete('JOB-ID-HERE'); // validation.id (returned by submit(), get() or list())
     * ```
     *
     * @param id The ID of the email validation job to delete.
     */
    delete(id, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            return deleteEmailValidation(this._restClientFactory, id, cancellationToken);
        });
    }
    /**
     * Lists all the email validation jobs, according to the specified listing options.
     *
     * This method returns a `Promise` which can be consumed using the async/await pattern (or through the
     * classic `then()` / `catch()` functions) and can be cancelled through a `CancellationToken`.
     *
     * Here is how to list all the jobs submitted on a specific date:
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     * const validations = verifalia
     *     .emailValidations
     *     .list({
     *         createdOn: new DateEqualityPredicate(new Date(2020, 10, 15))
     *     });
     *
     * for await (const validation of validations) {
     *     console.log(`ID: ${validation.id}, submitted: ${validation.submittedOn}`);
     * }
     * ```
     *
     * @param options The options for the listing operation.
     * @param cancellationToken An optional token used to cancel the asynchronous request.
     */
    list(options, cancellationToken) {
        return listEmailValidations(this._restClientFactory, options, cancellationToken);
    }
    /**
     * Returns a stream with an export of the specified completed email validation job, with the goal
     * of generating a *human-readable representation* of the results according to the requested output
     * file format. While the output schema (columns / labels / data format) is fairly complete, you
     * should always consider it as subject to change.
     *
     * This method returns a `Promise` which can be consumed using the async/await pattern (or through the
     * classic `then()` / `catch()` functions) and can be cancelled through a `CancellationToken`.
     *
     * Here is how to export a job in Microsoft Excel format:
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     *
     * const exportedData = await verifalia
     *     .emailValidations
     *     .export('dc21630a-6773-4bd0-b248-15e8b50c0d3e', MimeContentType_ExcelXlsx);
     *
     * // Either save the spreadsheet to file (Node.js-only):
     *
     * exportedData.pipe(fs.createWriteStream('/home/lbanfi/my-list.xls'));
     *
     * // Or display it in an iframe (browser only):
     *
     * document
     *     .getElementByID('my-iframe')
     *     .src = exportedData.toBlobURL(MimeContentType_ExcelXlsx);
     * ```
     *
     * @param id The ID of the email validation job to retrieve.
     * @param contentType The MIME content-type of output file format. Acceptable values:
     * - text/csv for comma-separated values files - CSV
     * - application/vnd.ms-excel for Microsoft Excel 97-2003 Worksheet (.xls)
     * - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet for Microsoft Excel workbook
     * (.xslx).
     * @param cancellationToken An optional token used to cancel the asynchronous request.
     * @returns A stream with the exported data.
     */
    export(id, contentType, cancellationToken) {
        return exportEmailValidationEntries(this._restClientFactory, id, contentType, cancellationToken);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
class CreditsRestClient {
    constructor(restClientFactory) {
        this._restClientFactory = restClientFactory;
    }
    /**
     * Returns the current credits balance for the Verifalia account.
     *
     * This method returns a `Promise` which can be consumed using the async/await pattern (or through the
     * classic `then()` / `catch()` functions) and can be cancelled through a `CancellationToken`.
     *
     * Here is an example:
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     *
     * const balance = await verifalia
     *     .credits
     *     .getBalance();
     *
     * console.log(`Credit packs: ${balance.creditPacks}, free credits: ${balance.freeCredits}`);
     * // 'Credit packs: 507.23, free credits: 10.86'
     * ```
     *
     * @param cancellationToken An optional token used to cancel the asynchronous request.
     */
    getBalance(cancellationToken) {
        return getCreditsBalance(this._restClientFactory, cancellationToken);
    }
    /**
     * Lists the daily usages of the credits for the Verifalia account, according to the specified
     * listing options.
     *
     * This method returns a `Promise` which can be consumed using the async/await pattern (or through the
     * classic `then()` / `catch()` functions) and can be cancelled through a `CancellationToken`.
     *
     * Here is how to list the credit daily usages between two dates:
     * ```ts
     * const verifalia = new VerifaliaRestClient(...);
     * const dailyUsages = verifalia
     *     .credits
     *     .listDailyUsages({
     *         dateFilter: new DateBetweenPredicate(new Date(2023, 2, 15), new Date(2023, 3, 1))
     *     });
     *
     * for await (const dailyUsage of dailyUsages) {
     *     console.log(`Date: ${dailyUsage.date}, credit packs: ${dailyUsage.creditPacks}, free credits: ${dailyUsage.freeCredits}`);
     *     // 'Date: 2023-02-15, credit packs: 98.85, free credits: 50'
     *     // 'Date: 2023-02-16, credit packs: 0, free credits: 19.26'
     *     // ...
     *     // 'Date: 2023-03-01, credit packs: 1.565, free credits: 50'
     * }
     * ```
     *
     * @param options A `DailyUsageListingOptions` with the options for the listing operation.
     * @param cancellationToken An optional token used to cancel the asynchronous request.
     */
    listDailyUsages(options, cancellationToken) {
        return listCreditsDailyUsages(this._restClientFactory, options, cancellationToken);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Thrown in the event all the Verifalia API endpoints are unreachable.
 */
class ServiceUnreachableError extends VerifaliaError {
    /**
     *
     */
    constructor(innerErrors) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        super(`All the base URIs are unreachable: ${innerErrors.map(error => `${error}`).join(', ')}`);
        this.innerErrors = innerErrors;
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
class RestError extends VerifaliaError {
    constructor(response, problem) {
        var _a;
        super((_a = problem === null || problem === void 0 ? void 0 : problem.detail) !== null && _a !== void 0 ? _a : `The request generated an HTTP ${response.status} status code.`);
        this.response = response;
        this.problem = problem;
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Thrown in the rare event a Verifalia API endpoint returns an HTTP server error status code (HTTP 5xx).
 */
class EndPointServerError extends RestError {
    constructor(response, problem) {
        super(response, problem);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Thrown in the event a request exceeded the maximum configured email validations rate or the maximum number
 * of concurrent requests from the same IP address.
 */
class RequestThrottledError extends RestError {
    constructor(response, problem) {
        super(response, problem);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Thrown when the credit of the requesting account is not enough to accept a given
 * email validation job.
 *
 * To add credit packs to your Verifalia account please visit https://verifalia.com/client-area#/credits/add
 */
class InsufficientCreditError extends RestError {
    constructor(response, problem) {
        super(response, problem);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * JSON content-type.
 */
const MimeContentType_ApplicationJson = 'application/json';
/**
 * RFC-9457 problem details (problem+json) content-type.
 */
const MimeContentType_ApplicationProblemJson = 'application/problem+json';
/**
 * Plain-text files (.txt), with one email address per line.
 */
const MimeContentType_TextPlain = 'text/plain';
/**
 * Comma-separated values (.csv).
 */
const MimeContentType_TextCsv = 'text/csv';
/**
 * Tab-separated values (usually coming with the .tsv extension).
 */
const MimeContentType_TextTsv = 'text/tab-separated-values';
/**
 * Microsoft Excel 97-2003 Worksheet (.xls).
 */
const MimeContentType_ExcelXls = 'application/vnd.ms-excel';
/**
 * Microsoft Excel workbook (.xslx).
 */
const MimeContentType_ExcelXlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/**
 * The problem+json type used to indicate the provided CAPTCHA token failed validation on the server side.
 */
const ProblemType_CaptchaValidationFailed = '/problems/captcha-validation-failed';

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Thrown in the event the user is unable to authenticate to Verifalia due to authentication-related issues, such as
 * invalid credentials or missing authentication tokens.
 */
class AuthenticationError extends RestError {
    constructor(response, problem) {
        super(response, problem);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Thrown in the event the provided CAPTCHA token failed the validation on the server side.
 */
class CaptchaValidationError extends AuthenticationError {
    constructor(response, problem) {
        super(response, problem);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
function parseRestProblem(response) {
    return __awaiter(this, void 0, void 0, function* () {
        const responseContentType = response.headers.get('Content-Type');
        if (responseContentType && responseContentType.includes(MimeContentType_ApplicationProblemJson)) {
            return yield response.json();
        }
    });
}

/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2015 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
/**
 * @typedef {object} PrivateData
 * @property {EventTarget} eventTarget The event target.
 * @property {{type:string}} event The original event object.
 * @property {number} eventPhase The current event phase.
 * @property {EventTarget|null} currentTarget The current event target.
 * @property {boolean} canceled The flag to prevent default.
 * @property {boolean} stopped The flag to stop propagation.
 * @property {boolean} immediateStopped The flag to stop propagation immediately.
 * @property {Function|null} passiveListener The listener if the current listener is passive. Otherwise this is null.
 * @property {number} timeStamp The unix time.
 * @private
 */

/**
 * Private data for event wrappers.
 * @type {WeakMap<Event, PrivateData>}
 * @private
 */
const privateData = new WeakMap();

/**
 * Cache for wrapper classes.
 * @type {WeakMap<Object, Function>}
 * @private
 */
const wrappers = new WeakMap();

/**
 * Get private data.
 * @param {Event} event The event object to get private data.
 * @returns {PrivateData} The private data of the event.
 * @private
 */
function pd(event) {
    const retv = privateData.get(event);
    console.assert(
        retv != null,
        "'this' is expected an Event object, but got",
        event
    );
    return retv
}

/**
 * https://dom.spec.whatwg.org/#set-the-canceled-flag
 * @param data {PrivateData} private data.
 */
function setCancelFlag(data) {
    if (data.passiveListener != null) {
        if (
            typeof console !== "undefined" &&
            typeof console.error === "function"
        ) {
            console.error(
                "Unable to preventDefault inside passive event listener invocation.",
                data.passiveListener
            );
        }
        return
    }
    if (!data.event.cancelable) {
        return
    }

    data.canceled = true;
    if (typeof data.event.preventDefault === "function") {
        data.event.preventDefault();
    }
}

/**
 * @see https://dom.spec.whatwg.org/#interface-event
 * @private
 */
/**
 * The event wrapper.
 * @constructor
 * @param {EventTarget} eventTarget The event target of this dispatching.
 * @param {Event|{type:string}} event The original event to wrap.
 */
function Event(eventTarget, event) {
    privateData.set(this, {
        eventTarget,
        event,
        eventPhase: 2,
        currentTarget: eventTarget,
        canceled: false,
        stopped: false,
        immediateStopped: false,
        passiveListener: null,
        timeStamp: event.timeStamp || Date.now(),
    });

    // https://heycam.github.io/webidl/#Unforgeable
    Object.defineProperty(this, "isTrusted", { value: false, enumerable: true });

    // Define accessors
    const keys = Object.keys(event);
    for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        if (!(key in this)) {
            Object.defineProperty(this, key, defineRedirectDescriptor(key));
        }
    }
}

// Should be enumerable, but class methods are not enumerable.
Event.prototype = {
    /**
     * The type of this event.
     * @type {string}
     */
    get type() {
        return pd(this).event.type
    },

    /**
     * The target of this event.
     * @type {EventTarget}
     */
    get target() {
        return pd(this).eventTarget
    },

    /**
     * The target of this event.
     * @type {EventTarget}
     */
    get currentTarget() {
        return pd(this).currentTarget
    },

    /**
     * @returns {EventTarget[]} The composed path of this event.
     */
    composedPath() {
        const currentTarget = pd(this).currentTarget;
        if (currentTarget == null) {
            return []
        }
        return [currentTarget]
    },

    /**
     * Constant of NONE.
     * @type {number}
     */
    get NONE() {
        return 0
    },

    /**
     * Constant of CAPTURING_PHASE.
     * @type {number}
     */
    get CAPTURING_PHASE() {
        return 1
    },

    /**
     * Constant of AT_TARGET.
     * @type {number}
     */
    get AT_TARGET() {
        return 2
    },

    /**
     * Constant of BUBBLING_PHASE.
     * @type {number}
     */
    get BUBBLING_PHASE() {
        return 3
    },

    /**
     * The target of this event.
     * @type {number}
     */
    get eventPhase() {
        return pd(this).eventPhase
    },

    /**
     * Stop event bubbling.
     * @returns {void}
     */
    stopPropagation() {
        const data = pd(this);

        data.stopped = true;
        if (typeof data.event.stopPropagation === "function") {
            data.event.stopPropagation();
        }
    },

    /**
     * Stop event bubbling.
     * @returns {void}
     */
    stopImmediatePropagation() {
        const data = pd(this);

        data.stopped = true;
        data.immediateStopped = true;
        if (typeof data.event.stopImmediatePropagation === "function") {
            data.event.stopImmediatePropagation();
        }
    },

    /**
     * The flag to be bubbling.
     * @type {boolean}
     */
    get bubbles() {
        return Boolean(pd(this).event.bubbles)
    },

    /**
     * The flag to be cancelable.
     * @type {boolean}
     */
    get cancelable() {
        return Boolean(pd(this).event.cancelable)
    },

    /**
     * Cancel this event.
     * @returns {void}
     */
    preventDefault() {
        setCancelFlag(pd(this));
    },

    /**
     * The flag to indicate cancellation state.
     * @type {boolean}
     */
    get defaultPrevented() {
        return pd(this).canceled
    },

    /**
     * The flag to be composed.
     * @type {boolean}
     */
    get composed() {
        return Boolean(pd(this).event.composed)
    },

    /**
     * The unix time of this event.
     * @type {number}
     */
    get timeStamp() {
        return pd(this).timeStamp
    },

    /**
     * The target of this event.
     * @type {EventTarget}
     * @deprecated
     */
    get srcElement() {
        return pd(this).eventTarget
    },

    /**
     * The flag to stop event bubbling.
     * @type {boolean}
     * @deprecated
     */
    get cancelBubble() {
        return pd(this).stopped
    },
    set cancelBubble(value) {
        if (!value) {
            return
        }
        const data = pd(this);

        data.stopped = true;
        if (typeof data.event.cancelBubble === "boolean") {
            data.event.cancelBubble = true;
        }
    },

    /**
     * The flag to indicate cancellation state.
     * @type {boolean}
     * @deprecated
     */
    get returnValue() {
        return !pd(this).canceled
    },
    set returnValue(value) {
        if (!value) {
            setCancelFlag(pd(this));
        }
    },

    /**
     * Initialize this event object. But do nothing under event dispatching.
     * @param {string} type The event type.
     * @param {boolean} [bubbles=false] The flag to be possible to bubble up.
     * @param {boolean} [cancelable=false] The flag to be possible to cancel.
     * @deprecated
     */
    initEvent() {
        // Do nothing.
    },
};

// `constructor` is not enumerable.
Object.defineProperty(Event.prototype, "constructor", {
    value: Event,
    configurable: true,
    writable: true,
});

// Ensure `event instanceof window.Event` is `true`.
if (typeof window !== "undefined" && typeof window.Event !== "undefined") {
    Object.setPrototypeOf(Event.prototype, window.Event.prototype);

    // Make association for wrappers.
    wrappers.set(window.Event.prototype, Event);
}

/**
 * Get the property descriptor to redirect a given property.
 * @param {string} key Property name to define property descriptor.
 * @returns {PropertyDescriptor} The property descriptor to redirect the property.
 * @private
 */
function defineRedirectDescriptor(key) {
    return {
        get() {
            return pd(this).event[key]
        },
        set(value) {
            pd(this).event[key] = value;
        },
        configurable: true,
        enumerable: true,
    }
}

/**
 * Get the property descriptor to call a given method property.
 * @param {string} key Property name to define property descriptor.
 * @returns {PropertyDescriptor} The property descriptor to call the method property.
 * @private
 */
function defineCallDescriptor(key) {
    return {
        value() {
            const event = pd(this).event;
            return event[key].apply(event, arguments)
        },
        configurable: true,
        enumerable: true,
    }
}

/**
 * Define new wrapper class.
 * @param {Function} BaseEvent The base wrapper class.
 * @param {Object} proto The prototype of the original event.
 * @returns {Function} The defined wrapper class.
 * @private
 */
function defineWrapper(BaseEvent, proto) {
    const keys = Object.keys(proto);
    if (keys.length === 0) {
        return BaseEvent
    }

    /** CustomEvent */
    function CustomEvent(eventTarget, event) {
        BaseEvent.call(this, eventTarget, event);
    }

    CustomEvent.prototype = Object.create(BaseEvent.prototype, {
        constructor: { value: CustomEvent, configurable: true, writable: true },
    });

    // Define accessors.
    for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        if (!(key in BaseEvent.prototype)) {
            const descriptor = Object.getOwnPropertyDescriptor(proto, key);
            const isFunc = typeof descriptor.value === "function";
            Object.defineProperty(
                CustomEvent.prototype,
                key,
                isFunc
                    ? defineCallDescriptor(key)
                    : defineRedirectDescriptor(key)
            );
        }
    }

    return CustomEvent
}

/**
 * Get the wrapper class of a given prototype.
 * @param {Object} proto The prototype of the original event to get its wrapper.
 * @returns {Function} The wrapper class.
 * @private
 */
function getWrapper(proto) {
    if (proto == null || proto === Object.prototype) {
        return Event
    }

    let wrapper = wrappers.get(proto);
    if (wrapper == null) {
        wrapper = defineWrapper(getWrapper(Object.getPrototypeOf(proto)), proto);
        wrappers.set(proto, wrapper);
    }
    return wrapper
}

/**
 * Wrap a given event to management a dispatching.
 * @param {EventTarget} eventTarget The event target of this dispatching.
 * @param {Object} event The event to wrap.
 * @returns {Event} The wrapper instance.
 * @private
 */
function wrapEvent(eventTarget, event) {
    const Wrapper = getWrapper(Object.getPrototypeOf(event));
    return new Wrapper(eventTarget, event)
}

/**
 * Get the immediateStopped flag of a given event.
 * @param {Event} event The event to get.
 * @returns {boolean} The flag to stop propagation immediately.
 * @private
 */
function isStopped(event) {
    return pd(event).immediateStopped
}

/**
 * Set the current event phase of a given event.
 * @param {Event} event The event to set current target.
 * @param {number} eventPhase New event phase.
 * @returns {void}
 * @private
 */
function setEventPhase(event, eventPhase) {
    pd(event).eventPhase = eventPhase;
}

/**
 * Set the current target of a given event.
 * @param {Event} event The event to set current target.
 * @param {EventTarget|null} currentTarget New current target.
 * @returns {void}
 * @private
 */
function setCurrentTarget(event, currentTarget) {
    pd(event).currentTarget = currentTarget;
}

/**
 * Set a passive listener of a given event.
 * @param {Event} event The event to set current target.
 * @param {Function|null} passiveListener New passive listener.
 * @returns {void}
 * @private
 */
function setPassiveListener(event, passiveListener) {
    pd(event).passiveListener = passiveListener;
}

/**
 * @typedef {object} ListenerNode
 * @property {Function} listener
 * @property {1|2|3} listenerType
 * @property {boolean} passive
 * @property {boolean} once
 * @property {ListenerNode|null} next
 * @private
 */

/**
 * @type {WeakMap<object, Map<string, ListenerNode>>}
 * @private
 */
const listenersMap = new WeakMap();

// Listener types
const CAPTURE = 1;
const BUBBLE = 2;
const ATTRIBUTE = 3;

/**
 * Check whether a given value is an object or not.
 * @param {any} x The value to check.
 * @returns {boolean} `true` if the value is an object.
 */
function isObject(x) {
    return x !== null && typeof x === "object" //eslint-disable-line no-restricted-syntax
}

/**
 * Get listeners.
 * @param {EventTarget} eventTarget The event target to get.
 * @returns {Map<string, ListenerNode>} The listeners.
 * @private
 */
function getListeners(eventTarget) {
    const listeners = listenersMap.get(eventTarget);
    if (listeners == null) {
        throw new TypeError(
            "'this' is expected an EventTarget object, but got another value."
        )
    }
    return listeners
}

/**
 * Get the property descriptor for the event attribute of a given event.
 * @param {string} eventName The event name to get property descriptor.
 * @returns {PropertyDescriptor} The property descriptor.
 * @private
 */
function defineEventAttributeDescriptor(eventName) {
    return {
        get() {
            const listeners = getListeners(this);
            let node = listeners.get(eventName);
            while (node != null) {
                if (node.listenerType === ATTRIBUTE) {
                    return node.listener
                }
                node = node.next;
            }
            return null
        },

        set(listener) {
            if (typeof listener !== "function" && !isObject(listener)) {
                listener = null; // eslint-disable-line no-param-reassign
            }
            const listeners = getListeners(this);

            // Traverse to the tail while removing old value.
            let prev = null;
            let node = listeners.get(eventName);
            while (node != null) {
                if (node.listenerType === ATTRIBUTE) {
                    // Remove old value.
                    if (prev !== null) {
                        prev.next = node.next;
                    } else if (node.next !== null) {
                        listeners.set(eventName, node.next);
                    } else {
                        listeners.delete(eventName);
                    }
                } else {
                    prev = node;
                }

                node = node.next;
            }

            // Add new value.
            if (listener !== null) {
                const newNode = {
                    listener,
                    listenerType: ATTRIBUTE,
                    passive: false,
                    once: false,
                    next: null,
                };
                if (prev === null) {
                    listeners.set(eventName, newNode);
                } else {
                    prev.next = newNode;
                }
            }
        },
        configurable: true,
        enumerable: true,
    }
}

/**
 * Define an event attribute (e.g. `eventTarget.onclick`).
 * @param {Object} eventTargetPrototype The event target prototype to define an event attrbite.
 * @param {string} eventName The event name to define.
 * @returns {void}
 */
function defineEventAttribute(eventTargetPrototype, eventName) {
    Object.defineProperty(
        eventTargetPrototype,
        `on${eventName}`,
        defineEventAttributeDescriptor(eventName)
    );
}

/**
 * Define a custom EventTarget with event attributes.
 * @param {string[]} eventNames Event names for event attributes.
 * @returns {EventTarget} The custom EventTarget.
 * @private
 */
function defineCustomEventTarget(eventNames) {
    /** CustomEventTarget */
    function CustomEventTarget() {
        EventTarget.call(this);
    }

    CustomEventTarget.prototype = Object.create(EventTarget.prototype, {
        constructor: {
            value: CustomEventTarget,
            configurable: true,
            writable: true,
        },
    });

    for (let i = 0; i < eventNames.length; ++i) {
        defineEventAttribute(CustomEventTarget.prototype, eventNames[i]);
    }

    return CustomEventTarget
}

/**
 * EventTarget.
 *
 * - This is constructor if no arguments.
 * - This is a function which returns a CustomEventTarget constructor if there are arguments.
 *
 * For example:
 *
 *     class A extends EventTarget {}
 *     class B extends EventTarget("message") {}
 *     class C extends EventTarget("message", "error") {}
 *     class D extends EventTarget(["message", "error"]) {}
 */
function EventTarget() {
    /*eslint-disable consistent-return */
    if (this instanceof EventTarget) {
        listenersMap.set(this, new Map());
        return
    }
    if (arguments.length === 1 && Array.isArray(arguments[0])) {
        return defineCustomEventTarget(arguments[0])
    }
    if (arguments.length > 0) {
        const types = new Array(arguments.length);
        for (let i = 0; i < arguments.length; ++i) {
            types[i] = arguments[i];
        }
        return defineCustomEventTarget(types)
    }
    throw new TypeError("Cannot call a class as a function")
    /*eslint-enable consistent-return */
}

// Should be enumerable, but class methods are not enumerable.
EventTarget.prototype = {
    /**
     * Add a given listener to this event target.
     * @param {string} eventName The event name to add.
     * @param {Function} listener The listener to add.
     * @param {boolean|{capture?:boolean,passive?:boolean,once?:boolean}} [options] The options for this listener.
     * @returns {void}
     */
    addEventListener(eventName, listener, options) {
        if (listener == null) {
            return
        }
        if (typeof listener !== "function" && !isObject(listener)) {
            throw new TypeError("'listener' should be a function or an object.")
        }

        const listeners = getListeners(this);
        const optionsIsObj = isObject(options);
        const capture = optionsIsObj
            ? Boolean(options.capture)
            : Boolean(options);
        const listenerType = capture ? CAPTURE : BUBBLE;
        const newNode = {
            listener,
            listenerType,
            passive: optionsIsObj && Boolean(options.passive),
            once: optionsIsObj && Boolean(options.once),
            next: null,
        };

        // Set it as the first node if the first node is null.
        let node = listeners.get(eventName);
        if (node === undefined) {
            listeners.set(eventName, newNode);
            return
        }

        // Traverse to the tail while checking duplication..
        let prev = null;
        while (node != null) {
            if (
                node.listener === listener &&
                node.listenerType === listenerType
            ) {
                // Should ignore duplication.
                return
            }
            prev = node;
            node = node.next;
        }

        // Add it.
        prev.next = newNode;
    },

    /**
     * Remove a given listener from this event target.
     * @param {string} eventName The event name to remove.
     * @param {Function} listener The listener to remove.
     * @param {boolean|{capture?:boolean,passive?:boolean,once?:boolean}} [options] The options for this listener.
     * @returns {void}
     */
    removeEventListener(eventName, listener, options) {
        if (listener == null) {
            return
        }

        const listeners = getListeners(this);
        const capture = isObject(options)
            ? Boolean(options.capture)
            : Boolean(options);
        const listenerType = capture ? CAPTURE : BUBBLE;

        let prev = null;
        let node = listeners.get(eventName);
        while (node != null) {
            if (
                node.listener === listener &&
                node.listenerType === listenerType
            ) {
                if (prev !== null) {
                    prev.next = node.next;
                } else if (node.next !== null) {
                    listeners.set(eventName, node.next);
                } else {
                    listeners.delete(eventName);
                }
                return
            }

            prev = node;
            node = node.next;
        }
    },

    /**
     * Dispatch a given event.
     * @param {Event|{type:string}} event The event to dispatch.
     * @returns {boolean} `false` if canceled.
     */
    dispatchEvent(event) {
        if (event == null || typeof event.type !== "string") {
            throw new TypeError('"event.type" should be a string.')
        }

        // If listeners aren't registered, terminate.
        const listeners = getListeners(this);
        const eventName = event.type;
        let node = listeners.get(eventName);
        if (node == null) {
            return true
        }

        // Since we cannot rewrite several properties, so wrap object.
        const wrappedEvent = wrapEvent(this, event);

        // This doesn't process capturing phase and bubbling phase.
        // This isn't participating in a tree.
        let prev = null;
        while (node != null) {
            // Remove this listener if it's once
            if (node.once) {
                if (prev !== null) {
                    prev.next = node.next;
                } else if (node.next !== null) {
                    listeners.set(eventName, node.next);
                } else {
                    listeners.delete(eventName);
                }
            } else {
                prev = node;
            }

            // Call this listener
            setPassiveListener(
                wrappedEvent,
                node.passive ? node.listener : null
            );
            if (typeof node.listener === "function") {
                try {
                    node.listener.call(this, wrappedEvent);
                } catch (err) {
                    if (
                        typeof console !== "undefined" &&
                        typeof console.error === "function"
                    ) {
                        console.error(err);
                    }
                }
            } else if (
                node.listenerType !== ATTRIBUTE &&
                typeof node.listener.handleEvent === "function"
            ) {
                node.listener.handleEvent(wrappedEvent);
            }

            // Break if `event.stopImmediatePropagation` was called.
            if (isStopped(wrappedEvent)) {
                break
            }

            node = node.next;
        }
        setPassiveListener(wrappedEvent, null);
        setEventPhase(wrappedEvent, 0);
        setCurrentTarget(wrappedEvent, null);

        return !wrappedEvent.defaultPrevented
    },
};

// `constructor` is not enumerable.
Object.defineProperty(EventTarget.prototype, "constructor", {
    value: EventTarget,
    configurable: true,
    writable: true,
});

// Ensure `eventTarget instanceof window.EventTarget` is `true`.
if (
    typeof window !== "undefined" &&
    typeof window.EventTarget !== "undefined"
) {
    Object.setPrototypeOf(EventTarget.prototype, window.EventTarget.prototype);
}

/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */

/**
 * The signal class.
 * @see https://dom.spec.whatwg.org/#abortsignal
 */
class AbortSignal extends EventTarget {
    /**
     * AbortSignal cannot be constructed directly.
     */
    constructor() {
        super();
        throw new TypeError("AbortSignal cannot be constructed directly");
    }
    /**
     * Returns `true` if this `AbortSignal`'s `AbortController` has signaled to abort, and `false` otherwise.
     */
    get aborted() {
        const aborted = abortedFlags.get(this);
        if (typeof aborted !== "boolean") {
            throw new TypeError(`Expected 'this' to be an 'AbortSignal' object, but got ${this === null ? "null" : typeof this}`);
        }
        return aborted;
    }
}
defineEventAttribute(AbortSignal.prototype, "abort");
/**
 * Create an AbortSignal object.
 */
function createAbortSignal() {
    const signal = Object.create(AbortSignal.prototype);
    EventTarget.call(signal);
    abortedFlags.set(signal, false);
    return signal;
}
/**
 * Abort a given signal.
 */
function abortSignal(signal) {
    if (abortedFlags.get(signal) !== false) {
        return;
    }
    abortedFlags.set(signal, true);
    signal.dispatchEvent({ type: "abort" });
}
/**
 * Aborted flag for each instances.
 */
const abortedFlags = new WeakMap();
// Properties should be enumerable.
Object.defineProperties(AbortSignal.prototype, {
    aborted: { enumerable: true },
});
// `toString()` should return `"[object AbortSignal]"`
if (typeof Symbol === "function" && typeof Symbol.toStringTag === "symbol") {
    Object.defineProperty(AbortSignal.prototype, Symbol.toStringTag, {
        configurable: true,
        value: "AbortSignal",
    });
}

/**
 * The AbortController.
 * @see https://dom.spec.whatwg.org/#abortcontroller
 */
class AbortController {
    /**
     * Initialize this controller.
     */
    constructor() {
        signals.set(this, createAbortSignal());
    }
    /**
     * Returns the `AbortSignal` object associated with this object.
     */
    get signal() {
        return getSignal(this);
    }
    /**
     * Abort and signal to any observers that the associated activity is to be aborted.
     */
    abort() {
        abortSignal(getSignal(this));
    }
}
/**
 * Associated signals.
 */
const signals = new WeakMap();
/**
 * Get the associated signal of a given controller.
 */
function getSignal(controller) {
    const signal = signals.get(controller);
    if (signal == null) {
        throw new TypeError(`Expected 'this' to be an 'AbortController' object, but got ${controller === null ? "null" : typeof controller}`);
    }
    return signal;
}
// Properties should be enumerable.
Object.defineProperties(AbortController.prototype, {
    signal: { enumerable: true },
    abort: { enumerable: true },
});
if (typeof Symbol === "function" && typeof Symbol.toStringTag === "symbol") {
    Object.defineProperty(AbortController.prototype, Symbol.toStringTag, {
        configurable: true,
        value: "AbortController",
    });
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
const logger$1 = new Logger('verifalia');
class MultiplexedRestClient {
    constructor(authenticator, baseUris, userAgent = undefined) {
        if (!authenticator)
            throw new Error('authenticator is null');
        if (!baseUris || !baseUris.length)
            throw new Error('baseUris is null or empty');
        this._authenticator = authenticator;
        this._userAgent = userAgent;
        this._baseUris = baseUris;
        this._noOfInvocations = 0;
    }
    invoke(request, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const errors = [];
            const abortController = new AbortController();
            const onCanceled = () => abortController.abort();
            if (cancellationToken) {
                cancellationToken.register(onCanceled);
            }
            try {
                // We will attempt invoking the Verifalia API a maximum of once per endpoint
                for (let idxAttempt = 0; idxAttempt < this._baseUris.length; idxAttempt++) {
                    const baseUri = this._baseUris[this._noOfInvocations++ % this._baseUris.length];
                    let requestInit = {
                        method: request.method,
                        body: request.data && request.data instanceof FormData
                            ? request.data
                            : JSON.stringify(request.data),
                        redirect: 'manual',
                        headers: {
                            // Default accepted MIME content type
                            'Accept': `${MimeContentType_ApplicationJson}, ${MimeContentType_ApplicationProblemJson}`
                        }
                    };
                    // Cancellation support
                    if (cancellationToken) {
                        requestInit.signal = abortController.signal;
                    }
                    // Adds the user-agent header only if it has been specified (can't be forced in the browser)
                    if (this._userAgent) {
                        requestInit.headers = Object.assign(Object.assign({}, requestInit.headers), { 'User-Agent': this._userAgent });
                    }
                    if (request.method === 'POST' || request.method === 'PUT') {
                        requestInit.headers = Object.assign(Object.assign({}, requestInit.headers), { 
                            // Default posted MIME content type
                            'Content-Type': MimeContentType_ApplicationJson });
                    }
                    requestInit = Object.assign(Object.assign({}, requestInit), request.configOverride);
                    if (!request.skipAuthentication) {
                        yield this._authenticator.authenticate(this, requestInit, cancellationToken);
                    }
                    const queryString = request.params
                        ? Object
                            .entries(request.params)
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            .map(([key]) => `${key}=${encodeURIComponent(request.params[key])}`)
                            .join('&')
                        : null;
                    const url = `${baseUri}${request.resource}${queryString ? '?' + queryString : ''}`;
                    // Display outgoing requests to the API on the console (debug build only)
                    logger$1.log('RequestInit', requestInit);
                    logger$1.log('invoking URL', url);
                    logger$1.log('params', JSON.stringify(request.params));
                    logger$1.log('data', JSON.stringify(request.data));
                    logger$1.log('headers', JSON.stringify(requestInit.headers));
                    let response;
                    try {
                        response = (yield fetch(url, requestInit));
                    }
                    catch (error) {
                        if (error.name === 'AbortError') {
                            // The request has been canceled
                            throw new OperationCanceledError();
                        }
                        errors.push(error);
                        continue;
                    }
                    // Parse any eventual RFC-9457 problem
                    const problem = yield parseRestProblem(response);
                    // Internal server error HTTP 5xx
                    if (response.status >= 500 && response.status <= 599) {
                        errors.push(new EndPointServerError(response, problem));
                        continue;
                    }
                    // Authentication error
                    if (response.status === 401) {
                        if (problem && problem.type === ProblemType_CaptchaValidationFailed) {
                            throw new CaptchaValidationError(response, problem);
                        }
                        else {
                            throw new AuthenticationError(response, problem);
                        }
                    }
                    // Authorization error
                    if (response.status === 403) {
                        yield this._authenticator.handleUnauthorizedRequest(this, response, problem, cancellationToken);
                    }
                    // Payment required
                    if (response.status === 402) {
                        throw new InsufficientCreditError(response, problem);
                    }
                    // Throttling
                    if (response.status === 429) {
                        throw new RequestThrottledError(response, problem);
                    }
                    return {
                        deserialize: () => __awaiter(this, void 0, void 0, function* () { return (yield response.json()); }),
                        response,
                        // Obsolete fields, for backward compatibility only
                        status: response.status,
                        statusText: response.statusText,
                        body: response.body,
                    };
                }
                throw new ServiceUnreachableError(errors);
            }
            finally {
                if (cancellationToken) {
                    cancellationToken.unregister(onCanceled);
                }
            }
        });
    }
}

// generated by genversion
const version = '5.0.0';

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * A factory of MultiplexedRestClient instances, used to issue REST commands against the Verifalia API.
 * This class is here to allow a fine-grained import of the required Verifalia features by the SDK consumers,
 * as well as to allow for the tree shaker to do its job.
 */
class VerifaliaRestClientFactory {
    /**
     * Initializes a new HTTPS-based REST client for Verifalia with the specified authenticator.
     *
     * @param authenticator The authenticator used to invoke the Verifalia service.
     * @param baseUris The base Verifalia API endpoints used to invoke the Verifalia service.
     */
    constructor(authenticator, baseUris) {
        /**
         * Gets or sets the version of the Verifalia API to use when making requests; defaults to the latest API
         * version supported by this SDK. Warning: changing this value may affect the stability of the SDK itself.
         */
        this.apiVersion = 'v2.6';
        if (!authenticator)
            throw new Error('authenticator is null');
        if (!baseUris || baseUris.length < 1)
            throw new Error('baseUris is null or has no items');
        this._authenticator = authenticator;
        this._baseUris = baseUris;
    }
    build() {
        if (!this._cachedRestClient) {
            // Initial uris shuffling (see https://stackoverflow.com/a/12646864/904178)
            const shuffledUris = [...this._baseUris];
            for (let i = shuffledUris.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledUris[i], shuffledUris[j]] = [shuffledUris[j], shuffledUris[i]];
            }
            this._cachedRestClient = new MultiplexedRestClient(this._authenticator, shuffledUris.map((uri) => `${uri}/${this.apiVersion}`), this.getUserAgent());
        }
        return this._cachedRestClient;
    }
    getUserAgent() {
        var _a;
        const isNode = (typeof process !== 'undefined') && ((_a = process.versions) === null || _a === void 0 ? void 0 : _a.node);
        if (isNode) {
            return `verifalia-rest-client/js/${version}/node/${process.platform + '/' + process.version},target:${'node'},format:${'es'}`;
        }
        // Since we can't force the User-Agent header in the browser, we return it as undefined here so that
        // the related header won't be set later, while making requests to the API.
        return undefined;
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Thrown in the event the user is authenticated but does not have the necessary permissions to access the requested
 * resource.
 */
class AuthorizationError extends RestError {
    constructor(response, problem) {
        super(response, problem);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Allows authentication against the Verifalia API using either a username-password credentials pair or a browser app-key.
 */
class UsernamePasswordAuthenticator {
    constructor(username, password) {
        if (!username) {
            throw Error('username is null or empty: please visit https://verifalia.com/client-area to set up a new user or a new browser app, if you don\'t have one.');
        }
        this._username = username;
        this._password = password || '';
    }
    authenticate(restClient, requestInit, cancellationToken) {
        requestInit.headers = Object.assign(Object.assign({}, requestInit.headers), { 'Authorization': 'Basic ' +
                Buffer.from(this._username + ":" + this._password).toString('base64') });
        return Promise.resolve();
    }
    handleUnauthorizedRequest(restClient, response, problem, cancellationToken) {
        throw new AuthorizationError(response, problem);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Allows to authenticate against the Verifalia API using an X.509 client certificate.
 * Learn more: https://verifalia.com/help/sub-accounts/what-is-x509-tls-client-certificate-authentication
 */
class ClientCertificateAuthenticator {
    constructor(cert, key, passphrase) {
        if (!cert) {
            throw Error('Invalid client certificate chain.');
        }
        this._agent = new Agent({
            cert,
            key,
            passphrase
        });
    }
    authenticate(restClient, requestInit) {
        // This will always be invoked in a Node.js-only context
        requestInit.agent = this._agent;
        return Promise.resolve();
    }
    handleUnauthorizedRequest(restClient, response, problem, cancellationToken) {
        throw new AuthorizationError(response, problem);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
const logger$2 = new Logger('verifalia');
/**
 * HTTPS-based REST client for Verifalia. This is the starting point to every other operation against
 * the Verifalia API, it allows to easily verify email addresses, manage submitted email validation
 * jobs and operate on the credits of the account.
 *
 * To submit and manage email validations, use the methods exposed by the `emailValidations` field.
 * To manage the credits for the Verifalia account, use the methods exposed by the `credits` field.
 *
 * Using this class requires to have a Verifalia account: if you don't yet have one, just register
 * for free at https://verifalia.com/sign-up/free
 */
class VerifaliaRestClient {
    /**
     * Initializes a new HTTPS-based REST client for Verifalia with the specified configuration.
     *
     * This constructor accepts either the user-name and password credentials of your root
     * Verifalia account, those of a Verifalia user (previously known as sub-accounts) or a Verifalia
     * browser app's key. As an alternative to the above, it is also possible to specify an X.509
     * client certificate for mutual TLS client authentication (only available in Node.js).
     *
     * For security reasons, it is always advisable to create and use a dedicated user for accessing
     * the Verifalia API, as doing so will allow to assign only the specific needed permissions to it.
     *
     * Here is how to create an instance of this class with a user-name and password pair:
     * ```ts
     * const verifalia = new VerifaliaRestClient({
     *   username: 'johndoe',
     *   password: 'mysecretpa$$word'
     * });
     * ```
     *
     * To use a browser app, pass its app key through the `username` field:
     * ```ts
     * const verifalia = new VerifaliaRestClient({
     *   username: '0a0321de08f54d3caff43951311bf958'
     * });
     * ```
     *
     * To authenticate using an X.509 client certificate (only available in Node.js), specify its public
     * key using the `cert` field and its private key with the `key` field:
     * ```ts
     * const verifalia = new VerifaliaRestClient({
     *   cert: fs.readFileSync('/home/rmontagnani/my-client-certificate.pem'),
     *   key: fs.readFileSync('/home/rmontagnani/my-client-certificate.key')
     * });
     * ```
     *
     * @param config Contains the configuration for the Verifalia API client, including the credentials
     * to use while authenticating to the Verifalia service.
     */
    constructor(config) {
        var _a, _b, _c;
        /**
         * Default Verifalia base URIs.
         */
        this._baseUris = [
            'https://api-1.verifalia.com',
            'https://api-2.verifalia.com',
            'https://api-3.verifalia.com',
        ];
        /**
         * Default Verifalia base URIs for client-certificate authentication.
         */
        this._baseCcaUris = [
            'https://api-cca-1.verifalia.com',
            'https://api-cca-2.verifalia.com',
            'https://api-cca-3.verifalia.com',
        ];
        if (!config)
            throw new Error('config is null');
        logger$2.log('Compilation', 'node', 'es');
        // Builds the authenticator
        let authenticator;
        let baseUris;
        if (config.authenticator) {
            authenticator = config.authenticator;
            baseUris = (_a = config.baseUris) !== null && _a !== void 0 ? _a : this._baseUris;
        }
        else if (config.username) {
            // User-name password authentication
            authenticator = new UsernamePasswordAuthenticator(config.username, config.password);
            baseUris = (_b = config.baseUris) !== null && _b !== void 0 ? _b : this._baseUris;
        }
        else if (config.cert && config.key) {
            // X.509 client certificate authentication (Node.js only)
            authenticator = new ClientCertificateAuthenticator(config.cert, config.key, config.passphrase);
            baseUris = (_c = config.baseUris) !== null && _c !== void 0 ? _c : this._baseCcaUris;
        }
        else {
            throw new Error('Invalid configuration: either specify your user credentials, your browser-app key, your client certificate or an Authenticator instance.');
        }
        this._restClientFactory = new VerifaliaRestClientFactory(authenticator, baseUris);
        this.credits = new CreditsRestClient(this._restClientFactory);
        this.emailValidations = new EmailValidationsRestClient(this._restClientFactory);
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
const JwtClaimMfaRequiredName = "verifalia:mfa";
const MaxNoOfMfaAttempts = 3;
/**
 * Allows authentication against the Verifalia API using bearer authentication.
 */
class BearerAuthenticator {
    constructor(username, password, totpProvider) {
        if (!username) {
            throw Error('username is null or empty: please visit https://verifalia.com/client-area to set up a new user or a new browser app, if you don\'t have one.');
        }
        if (!password) {
            throw Error('password is null or empty: please visit https://verifalia.com/client-area to set up a new user or a new browser app, if you don\'t have one.');
        }
        this._username = username;
        this._password = password;
        this._totpProvider = totpProvider;
    }
    authenticate(restClient, requestInit, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            // Request a new security token to the Verifalia API, if one is not yet available
            if (!this._accessToken) {
                const authRequest = new RestRequest('POST', '/auth/tokens', undefined, {
                    username: this._username,
                    password: this._password
                });
                authRequest.skipAuthentication = true;
                const authResponse = yield restClient.invoke(authRequest, cancellationToken);
                if (authResponse.response.status !== 200) {
                    const problem = yield parseRestProblem(authResponse.response);
                    throw new AuthenticationError(authResponse.response, problem);
                }
                let bearerAuthenticationResponse = yield authResponse.deserialize();
                this._accessToken = bearerAuthenticationResponse.accessToken;
                /* eslint-disable */
                const jwt = this.parseJwt(this._accessToken);
                /* eslint-enable */
                const authFactors = jwt[JwtClaimMfaRequiredName];
                if (authFactors) {
                    bearerAuthenticationResponse = yield this.provideAdditionalAuthFactor(restClient, authFactors, cancellationToken);
                    this._accessToken = bearerAuthenticationResponse.accessToken;
                }
            }
            requestInit.headers = Object.assign(Object.assign({}, requestInit.headers), { 'Authorization': `Bearer ${this._accessToken}` });
        });
    }
    provideAdditionalAuthFactor(restClient, authFactors, cancellationToken) {
        // We only support TOTP right now, but we may need to handle other factors in the future
        if (authFactors.find(factor => factor === 'totp')) {
            return this.provideTotpFactor(restClient, cancellationToken);
        }
        else {
            throw new Error(`No supported authentication factor was found among the advertised options: ${JSON.stringify(authFactors)}.`);
        }
    }
    provideTotpFactor(restClient, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._totpProvider) {
                throw new Error('A multi-factor authentication is required but no token provider has been provided.');
            }
            for (let idxAttempt = 0; idxAttempt < MaxNoOfMfaAttempts; idxAttempt++) {
                cancellationToken === null || cancellationToken === void 0 ? void 0 : cancellationToken.throwIfCancellationRequested();
                // Retrieve the one-time token from the configured device
                const totp = yield this._totpProvider
                    .provideTotp(cancellationToken);
                // Validates the provided token against the Verifalia API
                const totpVerificationRequest = new RestRequest('POST', '/auth/totp/verifications', undefined, {
                    passCode: totp
                }, {
                    headers: {
                        'Authorization': `Bearer ${this._accessToken}`
                    }
                });
                try {
                    const totpVerificationResponse = yield restClient.invoke(totpVerificationRequest, cancellationToken);
                    if (totpVerificationResponse.response.ok) {
                        return yield totpVerificationResponse.deserialize();
                    }
                }
                catch (exception) {
                    if (exception instanceof AuthorizationError) ;
                    else {
                        throw exception;
                    }
                }
            }
            throw new Error(`Invalid TOTP token provided after ${MaxNoOfMfaAttempts} attempt(s): aborting the authentication.`);
        });
    }
    handleUnauthorizedRequest(restClient, response, problem, cancellationToken) {
        throw new AuthorizationError(response, problem);
    }
    parseJwt(token) {
        // Adapted from https://stackoverflow.com/a/38552302/904178
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
class FilterPredicate {
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
class DateFilterPredicate extends FilterPredicate {
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
// Adapted from https://stackoverflow.com/a/23593099/904178
const formatDateToIso8601 = (date) => {
    const month = `${date.getMonth() + 1}`;
    const day = `${date.getDate()}`;
    const year = date.getFullYear();
    return [
        year,
        month.length < 2 ? '0' + month : month,
        day.length < 2 ? '0' + day : day
    ].join('-');
};

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
class DateBetweenPredicate extends DateFilterPredicate {
    constructor(since, until) {
        super();
        this.since = since;
        this.until = until;
    }
    serialize(fieldName) {
        const fragments = [];
        if (this.since) {
            fragments.push({
                key: `${fieldName}:since`,
                value: formatDateToIso8601(this.since)
            });
        }
        if (this.until) {
            fragments.push({
                key: `${fieldName}:until`,
                value: formatDateToIso8601(this.until)
            });
        }
        return fragments;
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
class DateEqualityPredicate extends DateFilterPredicate {
    constructor(date) {
        super();
        this.date = date;
    }
    serialize(fieldName) {
        return [
            {
                key: fieldName,
                value: `${formatDateToIso8601(this.date)}`
            }
        ];
    }
}

/**
 * @license
 * Verifalia - Email list cleaning and real-time email verification service
 * https://verifalia.com/
 * support@verifalia.com
 *
 * Copyright (c) 2005-2024 Cobisi Research
 *
 * Cobisi Research
 * Via Della Costituzione, 31
 * 35010 Vigonza
 * Italy - European Union
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
class CancellationToken {
    constructor() {
        this._isCanceled = false;
        this._callbacks = [];
    }
    isCanceled() {
        return this._isCanceled;
    }
    register(callback) {
        if (this._isCanceled) {
            callback();
            return;
        }
        this._callbacks.push(callback);
    }
    unregister(callback) {
        const index = this._callbacks.indexOf(callback);
        if (index >= 0) {
            this._callbacks.splice(index, 1);
        }
    }
    cancel() {
        this._isCanceled = true;
        for (const callback of this._callbacks) {
            callback();
        }
        this._callbacks = [];
    }
    throwIfCancellationRequested() {
        if (this.isCanceled()) {
            throw new OperationCanceledError();
        }
    }
}

export { AuthenticationError, AuthorizationError, BearerAuthenticator, CancellationToken, CaptchaValidationError, ClientCertificateAuthenticator, CreditsRestClient, DateBetweenPredicate, DateEqualityPredicate, EmailValidationsRestClient, EndPointServerError, InsufficientCreditError, MimeContentType_ApplicationJson, MimeContentType_ApplicationProblemJson, MimeContentType_ExcelXls, MimeContentType_ExcelXlsx, MimeContentType_TextCsv, MimeContentType_TextPlain, MimeContentType_TextTsv, ProblemType_CaptchaValidationFailed, RequestThrottledError, RestError, ServiceUnreachableError, UsernamePasswordAuthenticator, VerifaliaRestClient, VerifaliaRestClientFactory };
