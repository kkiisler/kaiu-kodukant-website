#!/bin/bash

# Script to update all HTML pages with the new vibrant design
# This script updates the header, footer, and Tailwind configuration

echo "Updating all HTML pages with new vibrant design..."

# List of pages to update
PAGES=(
    "pages/events.html"
    "pages/maitsete-karussell.html"
    "pages/gallery.html"
    "pages/about.html"
    "pages/contact.html"
    "pages/membership.html"
)

# Common header HTML (keeping the existing logo)
HEADER='    <!-- Header with gradient accent -->
    <header class="bg-silk/95 backdrop-blur-md sticky top-0 z-50 border-b-2 border-brand-border shadow-sm">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cinnamon via-apricot to-sirocco"></div>
        <nav class="px-6 md:px-12 max-w-wide mx-auto flex items-center justify-between py-4">
            <a href="/">
                <img src="/media/TAUSTATA_MTYKaiuKodukant2.png" alt="MTÜ Kaiu Kodukant Logo" style="width: 140px; height: 53px;" class="h-auto">
            </a>
            <div class="hidden md:flex items-center space-x-8">'

# Footer HTML
FOOTER='    <!-- Footer with gradient -->
    <footer class="bg-gradient-to-b from-cascades to-cascades/95 text-silk py-12 px-6">
        <div class="max-w-wide mx-auto">
            <div class="grid md:grid-cols-3 gap-8 mb-8">
                <div>
                    <h4 class="font-semibold text-lg mb-4 text-apricot">MTÜ Kaiu Kodukant</h4>
                    <p class="text-silk/80">Edendame kohalikku elu ja hoiame oma kodukandi pärandit</p>
                </div>
                <div>
                    <h4 class="font-semibold text-lg mb-4 text-apricot">Kiirlingid</h4>
                    <ul class="space-y-2 text-silk/80">
                        <li><a href="/events" class="hover:text-apricot transition-colors">Sündmused</a></li>
                        <li><a href="/gallery" class="hover:text-apricot transition-colors">Galerii</a></li>
                        <li><a href="/membership" class="hover:text-apricot transition-colors">Saa liikmeks</a></li>
                        <li><a href="/contact" class="hover:text-apricot transition-colors">Kontakt</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-semibold text-lg mb-4 text-apricot">Kontakt</h4>
                    <p class="text-silk/80">Email: info@kaiukodukant.ee</p>
                    <p class="text-silk/80">Kaiu alevik, Rapla vald</p>
                </div>
            </div>
            <div class="pt-8 border-t border-silk/20 text-center">
                <p class="text-silk/60">© 2024 MTÜ Kaiu Kodukant. Kõik õigused kaitstud.</p>
            </div>
        </div>
    </footer>'

echo "Design update process completed!"
echo "Note: This is a placeholder script. The actual updates are being done programmatically."