# High Level Overview

You are tasked with building a Chrome extension that would crawl the Gemini UI and collect information about chats in it into a local file. And then upon visiting a different site, the extension would populate that site with the data collected, and that site will use that data to display a better UI for Gemini. So you're tasked with basically two things. One is writing the Chrome extension, and the other one is writing the website that would use the data that is available on the Chrome extension. 

## Chrome Extension:

The behavior of the Chrome extension should be as follows. Upon visiting gemini.google.com/app, the extension would be able to read the contents of the site and specifically the left-hand menu and the title of each menu item, and the link, the URL that it links to, and it needs to collect those in a map of title, sorry, in a list, a JSON array of objects where each element in the array is an object with the title of the chat and the URL of the chat. As the user scrolls, the extension should keep collecting the data. 

The extension should also be able to save the data to a local storage to be used later.

## Website

The website can fetch the data stored to local storage by the extension and build a nicer, prettier UI for Gemini, specifically focusing around fetching old conversations and being able to search them. And this could be a completely client-side search over titles. 

## How you can figure out how to build this. 

Use the browsermcp functions available to you to browse to the Gemini page (https://gemini.google.com/app), inspect its source code, understand its structure, and understand how to scrape that structure from a Chrome extension. You are looking for content under the `conversations-list` element.

More specifically, each div under that conversation list element has a `jslog` field in it. And in it, it looks like this:
`186014;track:generic_click;BardVeMetadataKey:[null,null,null,null,null,null,null,[&quot;c_b048403da36b0a23&quot;,null,0,4]];mutable:true`
And you can see that the id of the chat is `c_b048403da36b0a23`. You can use this to extract the URL of the chat: `https://gemini.google.com/app/b048403da36b0a23`.
The title is a div with the class `conversation-title`.

## Instructions:

1. use browsermcp to crawl the Gemini page and figure out the html structure of the left-hand menu with the conversation titles and the URLs.
2. write the Chrome extension that would crawl the Gemini page, extract the data, and save it to local storage.
3. write the website that would fetch the data from local storage and display it in a nicer UI.
4. The core functionality of that UI is to provide that full list with titles and URLs and make it searchable in a client-side search.
5. Create any files that you need to in this repository for those two functionalities and put them in different folders, one for the extension and one for the site. It's very likely that we will just want the extension to open the site, so the site is not going to be a server as much as it is just a HTML page with javascriptthat will be opened by the extension. 




