// ==UserScript==
// @name         Amazon Reviews Confidence Percentages (3blue1brown)
// @namespace    https://github.com/gsuberland
// @source       https://github.com/gsuberland/amazon_3b1b_review_confidence
// @downloadURL  https://raw.githubusercontent.com/gsuberland/amazon_3b1b_review_confidence/master/amazon_3b1b_review_confidence.js
// @version      0.1
// @description  Computes confidence percentages on Amazon reviews as per 3blue1brown's video: https://www.youtube.com/watch?v=8idr1WZ1A7Q
// @author       Graham Sutherland (@gsuberland)
// @include      /^https://(www|smile)\.amazon\.(com|com\.br|ca|com\.mx|cn|in|co\.jp|sg|com\.tr|ae|fr|de|it|nl|es|co\.uk|com\.au)/.*$/
// @grant        GM_log
// ==/UserScript==

(function() {
    'use strict';

    /*
    A quick note on localisation:
    Some attempt has been made to make this work on different Amazon locales, but I have not tested all of them. Particularly, it is unlikely to work on Chinese, Japanese, or Russian locales.
    Regex matching on words has been written in a way that matches a-z as well as accented and extended latin characters.
    Regex matching on numbers should support either a period or comma as a separator (but not currently both) and contextual handling of this is performed later.
    */

    // set this if you want a bunch of console output for debugging.
    var debugMode = true;

    // popupRatingRegex is a regex to extract the ratings numbers from the ratings popup card.
    // this regex matches a string such as <span class="foo">4.6 out of 5</span>...<span ...>89  customer ratings</span> as per the current HTML that Amazon uses, and outputs the 4.6 and 89 as groups 1 and 3.
    // the "out of" is matched as any sequence of a-z or accented Latin characters, and numbers can have either a single comma or period in them.
    // the "customer ratings" text is generally not localised for some reason, but fair warning: this has only been checked on a few different localisations and probably won't work on all non-English sites.
    var popupRatingRegex = />([0-9]+([\.,][0-9]+)?)\s[a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\s\.]+\s+5<.+?>([0-9]+([\.,][0-9]+)?)\s+customer\s+ratings</mi;

    // productRatingRegex is a regex to extract the ratings from product listings.
    // this regex matches any numeric string (incl. localised) followed by a sequence of word characters followed by a space and then the number 5, e.g. "4.6 out of 5" or "4,6 von 5"
    // the rating value is returned in the first group.
    var productRatingRegex = /([0-9]+([\.,][0-9]+)?)\s[a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\s\.]+\s+5/mi;

    // this just uses GM_log to print a debug message, but prefixes string messages with the plugin identifier so you can spot them a little easier
    var logDebugMessage = function(message)
    {
        if (debugMode)
        {
            if (typeof message === 'string')
            {
                GM_log("[Amazon 3B1B Confidence Plugin] " + message);
            }
            else
            {
                GM_log(message);
            }
        }
    };

    var calculateConfidenceRating = function(ratingValue, ratingCount)
    {
        // calculate the confidence percentage
        let ratingAbsolute = ratingValue / 5.0;
        let goodRatings = ratingCount * ratingAbsolute;
        let badRatings = ratingCount * (1.0 - ratingAbsolute);
        let expectedSuccess = (goodRatings + 1.0) / (ratingCount + 2.0);
        let originalRatingPercent = +(ratingAbsolute * 100.0).toPrecision(3);
        let confidenceRatingPercent = +(expectedSuccess * 100.0).toPrecision(3);
        let correctionAmount = +(originalRatingPercent - confidenceRatingPercent).toPrecision(2);
        logDebugMessage(`Original rating is ${originalRatingPercent}% based on ${ratingValue}/5. Estimating ${goodRatings} good and ${badRatings} bad ratings out of a total ${ratingCount}, with a corrected confidence of ${confidenceRatingPercent}%.`);
        return [confidenceRatingPercent, originalRatingPercent, correctionAmount];
    };

    var handleProductNode = function(productNode)
    {
        // find the average rating and review count text elements in the product node
        let ratingTextNode = productNode.querySelector("span [data-action=a-popover] > a span");
        let countTextNode = productNode.querySelector("span [aria-label] > a > span");
        if (ratingTextNode != null && countTextNode != null)
        {
            logDebugMessage("Found rating text nodes.");
            let countContainerNode = countTextNode.parentElement.parentElement;
            if (countContainerNode != null)
            {
                logDebugMessage("Found rating text container.");
                if (countContainerNode.hasAttribute("processed-3b1b"))
                {
                    logDebugMessage("Already processed this node. Moving on.");
                }
                else
                {
                    logDebugMessage("This node has not yet been processed.");
                    logDebugMessage(ratingTextNode.innerText);
                    // match the product rating regex on the node's text
                    let match = productRatingRegex.exec(ratingTextNode.innerText);
                    if (match != null)
                    {
                        logDebugMessage("Matched on product regex.");
                        // extract values
                        let ratingValue = parseFloat(match[1].replace(",", ".")); // must swap out localised decimals to literals (e.g. "4,5" -> "4.5")
                        let ratingCount = parseInt(countTextNode.innerText.replace(",", "").replace(".", "")); // must strip periods and commas out for localised integers (e.g. "1,589" -> "1589" and "1.589" -> "1589")
                        logDebugMessage(`Rating is ${ratingValue} out of 5 with ${ratingCount} ratings.`);
                        // calculate the confidence values
                        let [confidenceRatingPercent, originalRatingPercent, correctionAmount] = calculateConfidenceRating(ratingValue, ratingCount);
                        // mark this node as processed, and add a new span after the link element
                        countContainerNode.setAttribute("processed-3b1b", "true");
                        let confidenceRatingSpan = document.createElement("span");
                        confidenceRatingSpan.style.fontWeight = "bold";
                        confidenceRatingSpan.innerText = `(${confidenceRatingPercent}%)`;
                        countContainerNode.appendChild(confidenceRatingSpan);
                    }
                }
            }
        }
    };

    // use an observer to process new elements as they arrive.
    var observer = new MutationObserver(function(mutations)
    {
        mutations.forEach(function(mutation)
        {
            logDebugMessage(mutation);
            // we only care about childList events for div element targets
            if (mutation.type == "childList" && mutation.target.nodeName == "DIV")
            {
                // turn the added nodes into an array for later usage
                let addedNodesArray = Array.from(mutation.addedNodes);

                // handle popover target (box that pops up when you hover a rating)
                if (mutation.target.className.includes("popover"))
                {
                    logDebugMessage("Found popover element.");
                    // match the popup rating regex on the mutation target's HTML
                    let match = popupRatingRegex.exec(mutation.target.innerHTML);
                    if (match != null)
                    {
                        logDebugMessage("Matched on popup regex.");
                        logDebugMessage(match);
                        // extract values
                        let ratingValue = parseFloat(match[1].replace(",", ".")); // must swap out localised decimals to literals (e.g. "4,5" -> "4.5")
                        let ratingCount = parseInt(match[3].replace(",", "").replace(".", "")); // must strip periods and commas out for localised integers (e.g. "1,589" -> "1589" and "1.589" -> "1589")
                        logDebugMessage(`Rating is ${ratingValue} out of 5 with ${ratingCount} ratings.`);
                        // find the average rating and review count text elements in the hover
                        let ratingTextNode = mutation.target.querySelector('[data-hook=acr-average-stars-rating-text]');
                        let countTextNode = mutation.target.querySelector('[data-hook=total-rating-count]');
                        if (ratingTextNode != null && countTextNode != null)
                        {
                            logDebugMessage("Found rating text nodes.");
                            logDebugMessage(ratingTextNode);
                            logDebugMessage(countTextNode);
                            // calculate the confidence values
                            let [confidenceRatingPercent, originalRatingPercent, correctionAmount] = calculateConfidenceRating(ratingValue, ratingCount);
                            // apply the text to the elements
                            ratingTextNode.innerText = `${ratingValue} out of 5 (${confidenceRatingPercent}%)`;
                            countTextNode.innerText = `${ratingCount} reviews. OR ${originalRatingPercent}% -> CR ${confidenceRatingPercent}% (diff ${correctionAmount}%)`;
                        }
                        else
                        {
                            logDebugMessage("Failed to find the rating text element.");
                        }
                    }
                }
                else if (mutation.addedNodes.length > 0 && addedNodesArray.some(n => n.hasAttribute("data-asin")))
                {
                    logDebugMessage("Found product elements.");
                    let productNodes = addedNodesArray.filter(n => n.hasAttribute("data-asin"));
                    for (let productNodeIdx in productNodes)
                    {
                        let productNode = productNodes[productNodeIdx];
                        handleProductNode(productNode);
                    }
                }
            }
        });
    });
    observer.observe(document, {subtree: true, attributes: false, childList: true});

    // process product elements on page load. popup elements do not need to be processed here as they will be caught by the observer.
    window.onload = function() {
        let productNodes = document.querySelectorAll("div [data-asin]");
        for (let productNodeIdx in productNodes)
        {
            let productNode = productNodes[productNodeIdx];
            handleProductNode(productNode);
        }
    };
})();
