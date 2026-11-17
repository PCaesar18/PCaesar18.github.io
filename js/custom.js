/*-----------------------------------------------------------
* Template Name    : Kerri | Responsive Bootstrap 4 Personal Template
* Author           : SRBThemes
* Version          : 1.0.0
* Created          : March 2018
* File Description : Main Js file of the template
*------------------------------------------------------------
*/

! function($) {
    "use strict";

    var KerriApp = function() {};

    //scroll
    KerriApp.prototype.initStickyMenu = function() {
        $(window).on('scroll',function() {
            var scroll = $(window).scrollTop();

            if (scroll >= 50) {
                $(".sticky").addClass("stickyadd");
            } else {
                $(".sticky").removeClass("stickyadd");
            }
        });
    },



    // CollapseHide
    KerriApp.prototype.initCollapseHide = function() {
        $(document).on('click', '.navbar-collapse.show', function(e) {
            if ($(e.target).is('a')) {
                $(this).collapse('hide');
            }
        });
    },

    //Smooth. Only in-page hash links. Page links such as Shop must navigate.
    KerriApp.prototype.initSmoothLink = function() {
        $('.navbar-nav a, .scroll_down a').on('click', function(event) {
            var href = $(this).attr('href');
            if (!href || href.charAt(0) !== '#' || href.length < 2) {
                return;
            }
            var $target = $(href);
            if (!$target.length) {
                return;
            }
            $('html, body').stop().animate({
                scrollTop: $target.offset().top - 0
            }, 1500, 'easeInOutExpo');
            event.preventDefault();
        });
    },

    //Scrollspy. The plugin treats every #navbarCollapse href as a jQuery
    //selector, so park non-hash links (Shop, blog cross-page links) for the
    //call and put them back immediately after. They are not removed.
    KerriApp.prototype.initScrollspy = function() {
        var $nav = $("#navbarCollapse");
        if (!$nav.length || typeof $.fn.scrollspy !== "function") {
            return;
        }

        var parked = [];
        $nav.find("a").each(function() {
            var href = this.getAttribute("href") || "";
            if (href.charAt(0) === "#") {
                return;
            }
            var marker = document.createComment("nav-external");
            this.parentNode.insertBefore(marker, this);
            parked.push({ node: this, marker: marker });
            this.parentNode.removeChild(this);
        });

        try {
            $nav.scrollspy({
                offset: 20
            });
        } finally {
            for (var i = 0; i < parked.length; i++) {
                var item = parked[i];
                item.marker.parentNode.insertBefore(item.node, item.marker.nextSibling);
                item.marker.parentNode.removeChild(item.marker);
            }
        }
    },

    //Typed
    KerriApp.prototype.initTextType = function() {
        $(".element").each(function() {
            var $this = $(this);
            $this.typed({
                strings: $this.attr('data-elements').split(','),
                typeSpeed: 100,
                backDelay: 3000
            });
        });
    },

    //Work
    KerriApp.prototype.initWork = function() {
        $(window).on('load', function () {
            var $container = $('.work-filter');
            var $filter = $('#menu-filter');
            $container.isotope({
                filter: '*',
                layoutMode: 'masonry',
                animationOptions: {
                    duration: 750,
                    easing: 'linear'
                }
            });

            $filter.find('a').on("click",function() {
                var selector = $(this).attr('data-filter');
                $filter.find('a').removeClass('active');
                $(this).addClass('active');
                $container.isotope({
                    filter: selector,
                    animationOptions: {
                        animationDuration: 750,
                        easing: 'linear',
                        queue: false,
                    }
                });
                return false;
            });
        });
    },

    //Magnificpop
    KerriApp.prototype.initMagnificPopup = function() {
        $('.img-zoom').magnificPopup({
            type: 'image',
            closeOnContentClick: true,
            mainClass: 'mfp-fade',
            gallery: {
                enabled: true,
                navigateByImgClick: true,
                preload: [0, 1]
            }
        });
    },

    //Client
    KerriApp.prototype.initTestimonial = function() {
        $("#owl-demo").owlCarousel({
            autoPlay: 7000,
            stopOnHover: true,
            navigation: false,
            paginationSpeed: 1000,
            goToFirstSpeed: 2000,
            singleItem: true,
            autoHeight: true,
        });
    },

    //PRELOADER
    KerriApp.prototype.initPreloader = function() {
        $('#status').fadeOut();
        $('#preloader').delay(350).fadeOut('slow');
        $('body').delay(350).css({
            'overflow': 'visible'
        });
    },

    // BACK TO TOP
    KerriApp.prototype.initBackToTop = function() {
        $(window).on('scroll',function(){
            if ($(this).scrollTop() > 100) {
                $('.back_top').fadeIn();
            } else {
                $('.back_top').fadeOut();
            }
        });
        $('.back_top').click(function(){
            $("html, body").animate({ scrollTop: 0 }, 1000);
            return false;
        });
    },

    // wavify Js
    KerriApp.prototype.initWave = function(){
        if($('#wave_img').length) {
            $('#wave_img').wavify({
                height: 100,
                bones: 3,
                amplitude: 50,
                color: '#fff',
                speed: .25
            });
        }
    }

    KerriApp.prototype.init = function() {
        this.initStickyMenu();
        this.initSmoothLink();
        this.initCollapseHide();
        this.initScrollspy();
        this.initTextType();
        this.initWork();
        this.initMagnificPopup();
        this.initPreloader();
        this.initTestimonial();
        this.initBackToTop();
        this.initWave();
    },
    //init
    $.KerriApp = new KerriApp, $.KerriApp.Constructor = KerriApp
}(window.jQuery),

//initializing
function($) {
    "use strict";
    $.KerriApp.init();
}(window.jQuery);
