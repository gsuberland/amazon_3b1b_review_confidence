# Amazon Reviews Confidence Percentages - 3blue1brown Edition
This is a user script that computes confidence percentages on Amazon reviews as per [3blue1brown's video on the product ratings](https://www.youtube.com/watch?v=8idr1WZ1A7Q). In short, it calculates a percentage confidence that you are likely to have a good experience with buying the product, based on the rating value and number of reviews.

The calculation is effectively just (goodReviews + 1) / (totalReviews + 2).

It has been tested on [Tampermonkey for Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) and should work on most Amazon websites (.com, .co.uk, .fr, .de, etc.) that use Latin characters, as well as the Amazon Smile subdomain.

## What does this script do?

Each product on Amazon shows a rating out of five stars, and the total number of reviews. This script adds the success confidence percentage in brackets next to the review count.

If you hover over the star rating on the product, you get the usual popout ratings box, with the addition of original rating (OR%), confidence rating (CR%), and the difference between the two.

## How do I use it?

Install the [Tampermonkey](https://www.tampermonkey.net/) plugin for your browser, then read [the user guide](https://www.tampermonkey.net/faq.php) on how to install user scripts. Once installed, the plugin should just work automatically when you visit Amazon.

I wrote this for fun, so don't expect a lot of support, but bug reports and pull requests are welcome. The code is released under MIT license if you wish to fork it.

