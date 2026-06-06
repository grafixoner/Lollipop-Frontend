var lollipop = {
  currentToken: '',
  apiurl: "https://api.lollipop.gg",
  baseurl: "https://lollipop.gg",
  nfts: {},
  iframe: false,
  loading: false,

  init: function(status) {
    if (lollipop.loading == false){
      lollipop.loading = true;
    }else{
      return false;
    }

    $('#wrapper').html('');

    try {
      this.currentToken = lollipop.getUrlVars()["t"].replace(/\b\#\w+/g, '');
    }catch{
      this.currentToken = location.pathname.split('/')[1];
    }

    if(this.currentToken === undefined || this.currentToken == ''){
      $('.command').html('<span class="spin"></span> Create your Web3 Identity, curate your Digital Collectibles and engage with your audience! <br><br>All from one link in the bio.<br><br>\
        <div class="">\
        <div class="relative mb-6">\
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-base">\
            https://lollipop.gg/\
          </div>\
          <input type="text" required id="claimlink" class="ml-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block w-full pl-[8.2rem] p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-green-500 dark:focus:border-green-500 text-lg" placeholder="username">\
        </div>\
        <a class="btn button mt-1 bg-green-300 md:text-lg text-lg p-2 rounded-lg shadow shadow-md" href="#claim" onClick="return claim();">Claim Link</a></div><p class="text-sm text-gray-500 lg:hidden">We recommend loading this in Phantom or Metamask Browser if you are on mobile.</p>');
      $('.sunburst').removeClass('blueberry').addClass('vanilla');

    }else{
      this.validatelollipop();
    }
  },

  getUrlVars: function() {
    var vars = [], hash;
    var regexp = /#\S+/g;

    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

    for(var i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');

      vars.push(hash[0]);
      try{
        vars[hash[0]] = hash[1].replace(regexp, '').replace('#','');
      }catch{}
    }

    return vars;
  },

  // -------------------------------------------------------------------------
  // General HTML helper
  // -------------------------------------------------------------------------

  escapeAttr: function(value) {
    if (value === undefined || value === null) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  // -------------------------------------------------------------------------
  // Optional analytics bridge
  // -------------------------------------------------------------------------
  // All real analytics logic lives in /display/js/lollipop_analytics.js.
  // These wrappers keep display.js render-safe and prevent this file from having
  // a hard dependency on analytics. If lollipop.analytics is missing, the page renders
  // normally and analytics calls become no-ops.

  analyticsTrack: function(eventType, payload) {
    try {
      if (lollipop.analytics && typeof lollipop.analytics.track === 'function') {
        lollipop.analytics.track(eventType, payload);
      }
    } catch (e) {}
  },

  analyticsAttrs: function(eventType, field, extra) {
    try {
      if (lollipop.analytics && typeof lollipop.analytics.attrs === 'function') {
        return lollipop.analytics.attrs(eventType, field, extra);
      }
    } catch (e) {}

    return '';
  },

  analyticsTrackProfileView: function(config) {
    try {
      if (lollipop.analytics && typeof lollipop.analytics.trackProfileView === 'function') {
        lollipop.analytics.trackProfileView(config);
      }
    } catch (e) {}
  },

  analyticsTrackSectionView: function(section, index) {
    try {
      if (lollipop.analytics && typeof lollipop.analytics.trackSectionView === 'function') {
        lollipop.analytics.trackSectionView(section, index);
      }
    } catch (e) {}
  },

  analyticsTrackFieldView: function(eventType, field, section, extra) {
    try {
      if (lollipop.analytics && typeof lollipop.analytics.trackFieldView === 'function') {
        lollipop.analytics.trackFieldView(eventType, field, section, extra);
      }
    } catch (e) {}
  },

  analyticsBindClicks: function() {
    try {
      if (lollipop.analytics && typeof lollipop.analytics.bindClicks === 'function') {
        lollipop.analytics.bindClicks();
      }
    } catch (e) {}
  },

  validatelollipop: async function(){
    var dir = 'configs';

    try{
      var iframe = parent.$('iframe').attr('id');
      if (iframe !== undefined && iframe == 'builder-frame') {
        dir = 'tmp';
        lollipop.iframe = true;
      }
    }catch{}

    var opts = {
      headers: {
        'mode':'no-cors'
      }
    };


    const token = String(this.currentToken || '').toLowerCase();


    lollipop.config = await fetch(`${lollipop.baseurl}/${dir}/${token}.json?ver=${Date.now()}`, opts)
      .then((res) => res.json())
      .then((res) => {
        try{
          $('.command').html('<span class="spin">👾</span> Found lollipop! Grabbing Data...');
          $('.sunburst > img').attr('src', res.image_url);
          $('.sunburst').removeClass('blueberry').addClass('vanilla');
          window.col = res;

          this.build_config(res);
          this.displayLink(res);
          $('#wrapper').removeClass('invisible');

          lollipop.analyticsTrackProfileView(res);

          return res;
        }catch{
          throw "Config File not found.";
        }
      })
      .catch((e) => {
        if (lollipop.currentToken != '' && window == window.parent) {
          window.location.href = lollipop.baseurl+"/build.html?t="+ lollipop.currentToken;

        }else if( window !== window.parent && this.iframe == true) {
          window.location.reload();
        }else{
          $('.command').html('<span class="spin"></span> Create your Web3 Identity, curate your Digital Collectibles and engage with your audience! <br><br>All from one link in the bio.<br><br>\
          <div class="">\
          <div class="relative mb-6">\
            <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-base">\
              https://lollipop.gg/\
            </div>\
            <input type="text" required id="claimlink" class="ml-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block w-full pl-[8.2rem] p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-green-500 dark:focus:border-green-500 text-lg" placeholder="username">\
          </div>\
          <p class="text-sm text-gray-600 lg:hidden mb-4">We recommend loading this in Phantom or Metamask Browser if you are on mobile.</p>\
          <a class="btn button mt-1 bg-green-300 md:text-lg text-lg p-2 rounded-lg shadow shadow-md" href="#claim" onClick="return claim();">Claim Link</a></div>');
          $('.sunburst').removeClass('blueberry').addClass('vanilla');
        }

        console.error(e);
        console.error('Could not find the IPFS config');
        return null;
      });
  },

  build_config: function(config){
    var newconfig = [];
    var count = 0;

    config.section.forEach(function(section){
      var fc = 0;
      var fields = [];

      if(!section.id){
        // This is from legacy configs and should be removed at this point.
        if(section.name.includes("Global")){
          section.id = "section_global_settings";
        }else if(section.name.includes("Header")){
          section.id = "section_header";
        }else if(section.name.includes("Header")){
          section.id = "section_header";
        }else if(section.name.includes("Link")){
          section.id = "section_links";
        }else if(section.name.includes("Rich")){
          section.id = "section_richtext";
        }else if(section.name.includes("Twitter")){
          section.id = "section_twitter";
        }else if(section.name.includes("Tweet")){
          section.id = "section_twitter";
        }else if(section.name.includes("Tagging")){
          section.id = "section_meta";
        }else if(section.name.includes("Meta")){
          section.id = "section_meta";
        }else if(section.name.includes("Gallery")){
          section.id = "section_gallery";
        }else if(section.name.includes("Team")){
          section.id = "section_team";
        }else if(section.name.includes("Youtube")){
          section.id = "section_youtube";
        }else if(section.name.includes("Mixtape")){
          section.id = "section_mixtape";
        }else if(section.name.includes("Footer")){
          section.id = "section_footer";
        }else{
          console.log('Help I need a Dev to Fix me! ASAP', section);
        }
      }

      section.fields.forEach(function(field){
        // This is legacy and only needed after first configs convert to new configs.
        try{
          if (!field.id && field.type == 'link') {
            field.id = "field_link";
          }

          if (field.id == 'header-image' || field.id == 'header-pfp'){
            delete field.id;
          }

          if (field.id !== undefined){
            fields[fc] = Object.assign({},schema[field.id], section.fields[fc]);
          }else{
            fields[fc] = Object.assign({},schema[section.id].fields[fc], section.fields[fc]);
          }

          fc++;
        }catch{}
      });

      config.section[count].fields = fields;
      config.section[count] = Object.assign({},schema[section.id], section);
      count++;
    });

    window.lollipop.config = config;
  },

  field_background: function(field, classes){
    return `<div class="`+ classes +`" style="background-image: url(`+field.value+`)"></div>`;
  },

  field_url: function(field, classes){
    return `<a href="`+lollipop.escapeAttr(field.value)+`"></a>`;
  },

  field_color: function(field, classes){
    return ``;
  },

  field_card_color: function(field, classes){
    return ``;
  },

  field_image: function(field, classes){
    return `<img class="`+ classes +`" src="`+lollipop.escapeAttr(field.value)+`" alt="">`;
  },

  field_text: function(field, classes){
    return `<p class="`+ classes +`">`+ field.value +`</p>`;
  },

  // Map a font key to a CSS font-family stack.
  fontFamily: function(key){
    var map = {
      indie:        "'Indie Flower', cursive",
      lato:         "'Lato', sans-serif",
      lobster:      "'Lobster', cursive",
      specialelite: "'Special Elite', cursive",
      fredericka:   "'Fredericka the Great', cursive"
    };
    return map[key] || '';
  },

  // Map a text-size key to a CSS font-size, per text kind (heading vs body).
  fontSizeFor: function(kind, key){
    var map = {
      heading: { small: '1.25rem',  medium: '1.75rem', large: '2.5rem' },
      body:    { small: '0.875rem', medium: '1rem',    large: '1.25rem' }
    };
    return (map[kind] && map[kind][key]) || '';
  },

  field_header: function(field, classes){
    // Heading color, font, alignment, and size all come from global settings fields[1].
    // Applied inline (not via Tailwind classes): sections are injected after load, so
    // the runtime JIT never generates dynamic utils, and inline beats competing rules
    // like `.card .nft-collection`.
    var headColor = '';
    var headFont  = '';
    var align     = 'center';
    var size      = '';
    try { headColor = col.section[0].fields[1].value || ''; } catch(e) {}
    try { headFont  = lollipop.fontFamily(col.section[0].fields[1].font); } catch(e) {}
    try { align     = col.section[0].fields[1].align || 'center'; } catch(e) {}
    try { size      = lollipop.fontSizeFor('heading', col.section[0].fields[1].textsize); } catch(e) {}
    // h3 is block (full width); pad the hugged side so left/right don't touch the edge.
    var pad = (align === 'left') ? 'padding-left:1rem;' : (align === 'right') ? 'padding-right:1rem;' : '';
    var style = 'display:block;text-align:' + align + ';color:' + headColor
              + (headFont ? ';font-family:' + headFont : '')
              + (size ? ';font-size:' + size : '') + ';' + pad;
    return `<h3 class="`+ classes +`" style="`+ style +`">`+field.value+`</h3>`;
  },

  field_link: function(field, classes){
    var text = field.title || field.name || 'Link';

    return `<a href="`+ lollipop.escapeAttr(field.value) +`"
               target="_blank"
               name="`+ lollipop.escapeAttr(field.title || '') +`"
               `+ lollipop.analyticsAttrs('link_click', field) +`>`+ text +`</a>`;
  },

  field_buttonlink: function(field,classes){
    var text = field.title || field.name || 'Link';

    return `<a target="_blank"
               href="`+ lollipop.escapeAttr(field.value) +`"
               `+ lollipop.analyticsAttrs('button_click', field) +`
               style="background-color:`+field.buttoncolor+`; color:`+field.textcolor+` "
               class="`+ classes+` inline-block w-full mb-2 bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-xl text-center items-center">
      <span>`+text+`</span>
      </a>`;
  },

  field_iconlink: function(field, classes){
    var text = `<i class="`+ classes +` text-4xl"></i>`;

    return `<a href="`+ lollipop.escapeAttr(field.value) +`"
               target="_blank"
               name="`+ lollipop.escapeAttr(field.title || '') +`"
               `+ lollipop.analyticsAttrs('social_click', field) +`>`+ text +`</a>`;
  },

  field_textbox: function(field, classes){
    // Body alignment + size from global settings fields[2], applied inline (same JIT
    // reason as field_header). px-4 already pads both edges.
    var align = 'center';
    var size  = '';
    try { align = col.section[0].fields[2].align || 'center'; } catch(e) {}
    try { size  = lollipop.fontSizeFor('body', col.section[0].fields[2].textsize); } catch(e) {}
    var style = 'text-align:' + align + (size ? ';font-size:' + size : '');
    // rt-content restores heading/list/quote styling that Tailwind's preflight strips.
    return `<div class="rt-content px-4 mb-8 lato `+classes+`" style="`+ style +`">`+ field.value +`</div>`;
  },

  field_youtube: function(field, classes){
    var videoId = this.youtubeID(field.value || '');

    lollipop.analyticsTrackFieldView('embed_view', field, null, {
      meta: {
        provider: 'youtube',
        video_id: videoId
      }
    });

    if((field.value || '').includes('autoplay')){
      videoId = videoId + "?&autoplay=1&mute=1";
    }

    return `<iframe allow="autoplay"
                    class="mb-8 px-4 w-full `+classes+`"
                    style="height:calc(100vw/2); max-height:450px"
                    src="//www.youtube.com/embed/` + videoId + `"
                    frameborder="0"
                    allowfullscreen></iframe>`;
  },

  field_tweet: function(field, classes){
    lollipop.analyticsTrackFieldView('embed_view', field, null, {
      meta: {
        provider: 'twitter'
      }
    });

    var src = 'https://platform.x.com/widgets.js';
    var s = document.createElement('script');
    s.setAttribute('src', src);
    document.body.appendChild(s);

    return `<div class="mx-4 mb-8 justify-center content-center flex `+classes+`">
              <blockquote class="twitter-tweet m-auto `+ classes +`">
                <a href="`+ lollipop.escapeAttr(field.value) +`"></a>
              </blockquote>
            </div>`;
  },

  field_xpost: function(field, classes){
    lollipop.analyticsTrackFieldView('embed_view', field, null, {
      meta: {
        provider: 'x'
      }
    });

    var src = 'https://platform.twitter.com/widgets.js';
    var s = document.createElement('script');
    s.setAttribute('src', src);
    document.body.appendChild(s);

    return `<div class="mx-4 mb-8 justify-center content-center flex `+classes+`">
              <blockquote class="twitter-tweet m-auto `+ classes +`">
                <a href="`+ lollipop.escapeAttr((field.value || '').replace('x.com', 'twitter.com')) +`"></a>
              </blockquote>
            </div>`;
  },

  field_tags: function(field, classes){
    var count = 0;
    var html = `<div class="tags mx-2 mb-8 `+classes+`">`;

    if (Array.isArray(field.value) == false){
      field.value = String(field.value || '').split(",");
    }

    field.value.forEach(function(tag){
      var color = ['green', 'yellow', 'blue', 'red', 'purple'];
      html += `<span class="text-base indie bg-` + color[count] + `-400 p-2 rounded-2xl text-black mr-4">`+ tag +`</span>`;
      if (count < color.length - 1){
        count++;
      }else {
        count = 0;
      }
    });

    html += `</div>`;
    return html;
  },

  field_shape: function(field, classes){
    return ``;
  },

  field_imagesize: function(field, classes){
    return ``;
  },

  field_slug: function(field, classes){
    var swipe = '';
    if (field.swipe == false){
      swipe = 'gap-2 grid nfts-grid';
    }

    var html = `<div id="nfts-`+field.value+`" data-slug="`+field.value+`" class="`+field.class+` `+swipe+` p-2 nfts w-full mb-6"><span class="throbbing"></span><span class="throbbing"></span><span class="throbbing"></span>
      </div>`;
    return html;
  },

  field_checkbox: function(field, classes){
    var html = lollipop['field_'+ field.method](field, classes);
    return html;
  },

  field_swipe: function(field, classes){
    return ``;
  },

  field_wallet: function(field, classes){
    var swipe = 'slider';
    if (field.swipe == false){
      swipe = 'gap-2 grid grid-cols-3 nfts-grid';
    }

    var nfts = `<div id="nfts-`+field.slug+`" data-slug="`+field.slug+`" class="`+field.class+` `+swipe+` `+field.size+` p-2 nfts w-full mb-6">`;

    field.value.forEach(function(nft){
      nfts += lollipop.build_nft(field,nft);
    });

    nfts += "</div>";
    return nfts;
  },

  field_gallery: function(field, classes){
    var imgs = (Array.isArray(field.value) ? field.value : []).filter(function(item){
      return item && item.image_url;
    });

    // MASONRY → Pinterest-style columns that keep each image's natural ratio.
    // Image size maps to column count (more columns = smaller images).
    if (field.masonry === true) {
      var cols = field.size === 'small' ? 3 : (field.size === 'large' ? 1 : 2);
      var html = `<div class="gallery-masonry w-full mb-6" style="column-count:`+cols+`;">`;
      imgs.forEach(function(item){
        var src = lollipop.escapeAttr(item.image_url);
        html += `<img class="gallery-img rounded-xl" data-full="`+src+`" src="`+src+`">`;
      });
      return html + `</div>`;
    }

    // SQUARE thumbnails — cover-cropped tiles, full image opens in the lightbox.

    // Square + swipe → horizontal flickity carousel of square tiles.
    if (field.swipe === true) {
      var html = `<div id="gallery-`+field.slug+`" class="slider gallery-square-slider `+field.size+` w-full mb-6">`;
      imgs.forEach(function(item){
        var src = lollipop.escapeAttr(item.image_url);
        html += `<div class="gallery-sq"><img class="gallery-img" data-full="`+src+`" src="`+src+`"></div>`;
      });
      return html + `</div>`;
    }

    // Square grid. Image size maps to column count (more columns = smaller tiles).
    var gcols = field.size === 'small' ? 4 : (field.size === 'large' ? 2 : 3);
    var html = `<div class="gallery-grid w-full mb-6" style="grid-template-columns:repeat(`+gcols+`,minmax(0,1fr));">`;
    imgs.forEach(function(item){
      var src = lollipop.escapeAttr(item.image_url);
      html += `<div class="gallery-sq"><img class="gallery-img" data-full="`+src+`" src="`+src+`"></div>`;
    });
    return html + `</div>`;
  },

  // Gallery layout-toggle checkbox renders nothing on the public page.
  field_masonry: function(field, classes){
    return ``;
  },

  // Team "round headshots?" toggle renders nothing on the public page.
  field_round: function(field, classes){
    return ``;
  },

  // Team bio-alignment control renders nothing itself; its value is applied in field_team.
  field_textalign: function(field, classes){
    return ``;
  },

  field_team: function(field, classes){
    var members = (Array.isArray(field.value) ? field.value : []).filter(function(m){
      return m && (m.image_url || m.title || m.subtitle || m.description);
    });
    if (!members.length) return ``;

    var round = field.round === false ? '' : ' team-card__photo--round';
    var bioAlign = field.bioAlign || 'center';
    var html = `<div class="team-grid w-full mb-6">`;
    members.forEach(function(m){
      var img = m.image_url
        ? `<div class="team-card__photo${round}" style="background-image:url(` + lollipop.escapeAttr(m.image_url) + `)"></div>`
        : ``;
      var name = m.title ? `<div class="team-card__name">` + lollipop.escapeAttr(m.title) + `</div>` : ``;
      var role = m.subtitle ? `<div class="team-card__role">` + lollipop.escapeAttr(m.subtitle) + `</div>` : ``;
      var bio  = m.description ? `<div class="team-card__bio" style="text-align:` + bioAlign + `">` + lollipop.escapeAttr(m.description) + `</div>` : ``;
      html += `<div class="team-card">` + img + name + role + bio + `</div>`;
    });
    html += `</div>`;
    return html;
  },

  // Tap any gallery image to open it full-size. Overlay is created lazily, once.
  bind_gallery_lightbox: function(){
    $(document).off('click.gallerylb').on('click.gallerylb', '.gallery-img', function(){
      var src = $(this).attr('data-full') || $(this).attr('src');
      if (!src) return;
      var $lb = $('#galleryLightbox');
      if (!$lb.length) {
        $lb = $('<div id="galleryLightbox" class="gallery-lightbox"><span class="gallery-lightbox__close">&times;</span><img alt=""></div>').appendTo('body');
        $lb.on('click', function(){ $lb.removeClass('is-open'); });
      }
      $lb.find('img').attr('src', src);
      $lb.addClass('is-open');
    });
  },

  field_button: function(field, classes){
    return `<a style="background-color:`+field.buttoncolor+`; color:`+field.textcolor+` "
               class="block text-center mx-8 my-2 p-2 rounded-xl hover:opacity-100 opacity-75"
               href="`+ lollipop.escapeAttr(field.value) +`"
               `+ lollipop.analyticsAttrs('button_click', field) +`>`+field.title+`</a>`;
  },

  field_stats: function(field, classes){
    if (field.value == false){
      return ``;
    }else{
      if (field.slug === undefined){
        field.slug = this.currentToken;
        field.chain = this.currentChain;
      }

      if(field.chain !== undefined){
        const stats = fetch(this.apiurl+`/collection/`+field.chain+`/`+ field.slug+`/stats`)
          .then((res) => res.json())
          .then((res) => {
            $('.'+field.slug+' .totalSupply').html(res.totalSupply);
            $('.'+field.slug+' .uniqueHolders').html(res.uniqueHolders);
            $('.'+field.slug+' .floor').html(res.floor);
          }).catch((e) => {
            console.error(e);
          });

        var html = `<div class="`+field.slug+` `+classes+` w-full grid grid-cols-3 gap-0 w-100 h-12 text-center border-black">
                    <div class="grid place-content-center text-center col-start-1 col-end-1"><span class="uniqueHolders font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">Holders</div></div>
                    <div class="grid place-content-center col-start-2 border-l col-end-2"><span class="totalSupply font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">Supply</div></div>
                    <div class="grid place-content-center col-start-3 border-l col-end-3"><span class="floor font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">Floor</div></div>
                  </div>`;
      }else{
        var html = `<div class="`+field.slug+` `+classes+` w-full grid grid-cols-2 gap-0 w-100 h-12 text-center border-black">
                    <div class="grid place-content-center text-center col-start-1 col-end-1"><span class="uniqueHolders font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">lollipops</div></div>
                    <div class="grid place-content-center col-start-2 border-l col-end-2"><span class="totalSupply font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">Collectibles</div></div>
                  </div>`;
      }

      return html;
    }
  },

  show_nft: function(){
    var nft = $(event.target).parent().data('nft');
    var nftData = lollipop.nfts[nft];

    if (!nftData) {
      return;
    }

    lollipop.analyticsTrack('image_click', {
      field_type: 'nft',
      field_title: nftData.name || null,
      target_url: nftData.permalink || null,
      meta: {
        nft_key: nft,
        collection: nftData.collection || null,
        chain: nftData.chain || null,
        image_url: nftData.image_url || null
      }
    });

    $("#nftModal img").attr('src', nftData.image_url);
    $("#nftModal title").html(nftData.name);
    $("#nftModal lollipop").html(nftData.collection);
    $("#nftModal .permalink")
      .attr('href', nftData.permalink)
      .attr('data-lollipop-track', 'outbound_click')
      .attr('data-field-type', 'nft_marketplace')
      .attr('data-field-title', nftData.name || '')
      .attr('data-target-url', nftData.permalink || '');

    if(nftData.chain == 'ETH'){
      $("#nftModal .permalink")
        .html('<i class="ict-brands ict-opensea text-blue-800"></i> <span class="flex-1 text-lg pr-8">View on Opensea</span>')
        .removeClass('bg-gray-900 text-white rounded-xl')
        .addClass('bg-gray-300 text-gray-900 rounded-full');
    }else{
      $("#nftModal .permalink")
        .html('<i class="ml-6 text-xl ict-brands ict-me"></i> <span class="flex-1 text-base pr-6 elite pt-1">View on MagicEden</span>')
        .removeClass('bg-gray-300 text-gray-900 rounded-full')
        .addClass('bg-gray-900 text-white rounded-xl');
    }

    $("#nftModal").modal({
      fadeDuration: 1000,
      fadeDelay: 0.50
    });
  },

  verify_nft: async function(slug,nft){
    // Kept as placeholder for future validation.
  },

  build_nft: function(field,nft){
    var slug = Math.random().toString(36).slice(2);
    this.nfts[slug] = nft;

    var rounded = "rounded-xl";
    if(field.round == true){
      rounded = "rounded-full";
    }

    return `<span onClick="lollipop.show_nft()" data-nft='`+slug+`' class="nft relative `+field.class+`">
              <img class="`+field.size+` autoFix `+rounded+`" src="`+nft.image_url+`">
              <span class="verified badge whitespace-nowrap w-6 h-6 overflow-hidden absolute bottom-0 left-0 opacity-50 bg-black text-white indie text-xs rounded-full p-1 m-1"><i class="fa-solid fa-ice-cream text-white mr-1"></i></span>
            </span>`;
  },

  build_header: function(section, classes){
    var header_html = "";
    section.fields.forEach(function(field){
      header_html += lollipop['field_'+ field.type](field, field.class);
    });
    return header_html;
  },

  build_official_links: function(section, classes){
    var iconhtml = ``;
    var icons = false;
    var buttoncolor = '#f7f7f7';
    var textcolor = '#222222';

    section.fields.forEach(function(field){
      if (field.method == 'icons'){
        if (field.value == true) {
          icons = true;
        }
      }else if (field.method == 'buttoncolor'){
        buttoncolor = field.value;
      }else if (field.method == 'textcolor'){
        textcolor = field.value;
      }else{
        if(icons == false){
          field['buttoncolor'] = buttoncolor;
          field['textcolor'] = textcolor;
          iconhtml += lollipop['field_buttonlink'](field, field.class);
        }else{
          iconhtml += lollipop['field_iconlink'](field, field.icon);
        }
      }
    });

    var layout = 'buttons';
    if (icons == true){
      layout = 'flex text-4xl gap-2';
    }

    var html = `<div class=" `+classes+` `+layout+` px-4 mb-6 links text-center items-center justify-center social">`;
    html += iconhtml;
    html += `</div>`;
    return html;
  },

  // No-op stubs — these fields are handled via method or build_* functions
  field_playlist: function(field, classes) { return ''; },
  field_skin:     function(field, classes) { return ''; },
  field_font:     function(field, classes) { return ''; },

  // -------------------------------------------------------------------------
  // Mixtape — state store and YouTube API loader
  // -------------------------------------------------------------------------
  _mixtapeQueue:   [],   // pending {id, tracks, mysteryMode} waiting for YT API
  _mixtapePlayers: {},   // YT.Player instances keyed by section id
  _mixtapeState:   {},   // playback state keyed by section id

  _loadYouTubeAPI: function() {
    if (window._ytApiLoading || (window.YT && window.YT.Player)) return;
    window._ytApiLoading = true;
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function() {
      if (typeof prev === 'function') prev();
      lollipop._mixtapeQueue.forEach(function(p) {
        lollipop._initMixtapePlayer(p.id, p.tracks, p.mysteryMode);
      });
      lollipop._mixtapeQueue = [];
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  },

  _queueOrInitPlayer: function(id, tracks, mysteryMode) {
    if (window.YT && window.YT.Player) {
      lollipop._initMixtapePlayer(id, tracks, mysteryMode);
    } else {
      lollipop._mixtapeQueue.push({ id: id, tracks: tracks, mysteryMode: mysteryMode });
    }
  },

  _initMixtapePlayer: function(id, tracks, mysteryMode) {
    lollipop._mixtapeState[id] = {
      tracks:      tracks,
      mysteryMode: mysteryMode,
      current:     0,
      playing:     false,
      started:     false,   // mystery mode reveals nothing until the first play
      timer:       null,
      volume:      80,
      muted:       false
    };
    lollipop._mixtapePlayers[id] = new YT.Player(id + '-yt', {
      width: '1', height: '1',
      videoId: tracks[0] ? tracks[0].youtubeVideoId : '',
      playerVars: { playsinline: 1, enablejsapi: 1, origin: location.origin },
      events: {
        onStateChange: function(e) { lollipop._onMixtapeStateChange(id, e); },
        onError:       function()  { lollipop._mixtapeNext(id); }
      }
    });
  },

  _onMixtapeStateChange: function(id, e) {
    var st = lollipop._mixtapeState[id];
    if (!st) return;
    if (e.data === YT.PlayerState.PLAYING) {
      st.playing = true;
      lollipop._setPlayIcon(id, true);
      lollipop._revealNowPlaying(id);   // a track is actually playing now → reveal it
      clearInterval(st.timer);
      st.timer = setInterval(function() { lollipop._tickProgress(id); }, 500);
    } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.BUFFERING) {
      if (e.data === YT.PlayerState.PAUSED) {
        st.playing = false;
        lollipop._setPlayIcon(id, false);
        clearInterval(st.timer);
      }
    } else if (e.data === YT.PlayerState.ENDED) {
      clearInterval(st.timer);
      lollipop._mixtapeNext(id);
    }
  },

  _setPlayIcon: function(id, playing) {
    var btn = document.getElementById(id + '-play');
    if (!btn) return;
    btn.innerHTML = playing
      ? '<i class="fa-solid fa-pause"></i>'
      : '<i class="fa-solid fa-play"></i>';
  },

  _tickProgress: function(id) {
    var p  = lollipop._mixtapePlayers[id];
    var st = lollipop._mixtapeState[id];
    if (!p || !st) return;
    try {
      var cur = p.getCurrentTime();
      var dur = p.getDuration();
      var pct = dur > 0 ? (cur / dur * 100) : 0;
      var fill = document.getElementById(id + '-fill');
      if (fill) fill.style.width = pct + '%';
      var fmt = function(s) {
        s = Math.floor(s || 0);
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      };
      var timeEl = document.getElementById(id + '-time');
      if (timeEl) timeEl.textContent = fmt(cur) + ' / ' + fmt(dur);
    } catch(e) {}
  },

  mixtapePlay: function(id) {
    var p  = lollipop._mixtapePlayers[id];
    var st = lollipop._mixtapeState[id];
    if (!p || !st) return;
    st.playing ? p.pauseVideo() : p.playVideo();
  },

  _mixtapeNext: function(id) {
    var st = lollipop._mixtapeState[id];
    if (!st) return;
    lollipop.mixtapeGoTo(id, (st.current + 1) % st.tracks.length);
  },

  _mixtapePrev: function(id) {
    var st = lollipop._mixtapeState[id];
    if (!st) return;
    lollipop.mixtapeGoTo(id, (st.current - 1 + st.tracks.length) % st.tracks.length);
  },

  _mixtapeFmt: function(s) {
    s = Math.floor(s || 0);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  },

  // Reveal or re-hide a single track row (mystery mode).
  _mixtapeRenderRow: function(id, i, reveal) {
    var st = lollipop._mixtapeState[id];
    if (!st) return;
    var track = st.tracks[i];
    var row = document.querySelector('#' + id + '-list .mx-track[data-index="' + i + '"]');
    if (!row || !track) return;
    var titleEl = row.querySelector('.mx-track-title');
    var subEl   = row.querySelector('.mx-track-sub');
    var img     = row.querySelector('img');
    var dur = track.durationSeconds ? lollipop._mixtapeFmt(track.durationSeconds) : '';
    if (reveal) {
      if (titleEl) titleEl.textContent = track.title || '';
      if (subEl)   subEl.textContent   = (track.artist || '') + ((track.artist && dur) ? ' · ' : '') + dur;
      if (img)     img.classList.remove('mx-blur');
    } else {
      if (titleEl) titleEl.textContent = '? ? ?';
      if (subEl)   subEl.textContent   = '';
      if (img)     img.classList.add('mx-blur');
    }
  },

  // Reveal the now-playing track (and, in mystery mode, ONLY its row — everything
  // else stays hidden). Marks the mixtape as started, which clears the explainer.
  _revealNowPlaying: function(id) {
    var st = lollipop._mixtapeState[id];
    if (!st) return;
    st.started = true;
    var track = st.tracks[st.current];
    if (!track) return;
    var dur = track.durationSeconds ? lollipop._mixtapeFmt(track.durationSeconds) : '';
    var titleEl = document.getElementById(id + '-title');
    var subEl   = document.getElementById(id + '-sub');
    var tEl     = document.getElementById(id + '-thumb');
    if (titleEl) titleEl.textContent = track.title || '';
    if (subEl)   subEl.textContent   = (track.artist || '') + ((track.artist && dur) ? ' · ' : '') + dur;
    if (tEl)     tEl.classList.remove('mx-blur');
    if (st.mysteryMode) {
      st.tracks.forEach(function(_, i) {
        lollipop._mixtapeRenderRow(id, i, i === st.current);
      });
    }
  },

  mixtapeGoTo: function(id, index) {
    var p  = lollipop._mixtapePlayers[id];
    var st = lollipop._mixtapeState[id];
    if (!p || !st) return;
    var track = st.tracks[index];
    if (!track) return;
    st.current = index;
    p.loadVideoById(track.youtubeVideoId);

    // Now-playing thumb, then reveal the current track (it's about to play).
    var tEl = document.getElementById(id + '-thumb');
    if (tEl) tEl.src = 'https://i.ytimg.com/vi/' + track.youtubeVideoId + '/mqdefault.jpg';
    lollipop._revealNowPlaying(id);

    // Highlight active row in track list
    var list = document.getElementById(id + '-list');
    if (list) {
      list.querySelectorAll('.mx-track').forEach(function(li, i) {
        li.classList.toggle('mx-track-active', i === index);
      });
    }

    // Reset progress
    var fill   = document.getElementById(id + '-fill');
    var timeEl = document.getElementById(id + '-time');
    if (fill)   fill.style.width = '0%';
    if (timeEl) timeEl.textContent = '0:00 / 0:00';
  },

  mixtapeSeek: function(id, e) {
    var p = lollipop._mixtapePlayers[id];
    if (!p) return;
    var rect = e.currentTarget.getBoundingClientRect();
    p.seekTo(((e.clientX - rect.left) / rect.width) * p.getDuration(), true);
  },

  mixtapeVolume: function(id, val) {
    var p  = lollipop._mixtapePlayers[id];
    var st = lollipop._mixtapeState[id];
    if (!p || !st) return;
    val = parseInt(val, 10);
    st.volume = val;
    if (val === 0) {
      p.mute();
      st.muted = true;
    } else {
      if (st.muted) { p.unMute(); st.muted = false; }
      p.setVolume(val);
    }
  },

  // -------------------------------------------------------------------------
  // Mixtape section renderer
  // -------------------------------------------------------------------------
  build_mixtape: function(section, classes) {
    var title       = '';
    var tracks      = [];
    var tapEnabled  = false;
    var skin        = 'minimal';
    var mysteryMode = false;
    // Fallbacks so empty/missing values in the config still render dark grey / light grey
    // (older drafts may have saved "" or no color at all).
    var playerColor     = '#3a3a3a';
    var playerTextColor = '#cccccc';

    section.fields.forEach(function(field) {
      if      (field.type === 'header')   { title  = field.value || ''; }
      else if (field.type === 'playlist') { tracks = Array.isArray(field.value) ? field.value : []; }
      else if (field.type === 'skin')     { skin   = field.value || 'minimal'; }
      else if (field.type === 'color' && field.method === 'playercolor')     { playerColor     = field.value || '#3a3a3a'; }
      else if (field.type === 'color' && field.method === 'playertextcolor') { playerTextColor = field.value || '#cccccc'; }
      else if (field.type === 'checkbox') {
        if (field.class && field.class.indexOf('mixtape-tap-toggle') !== -1)
          tapEnabled = field.value === true;
        else
          mysteryMode = field.value === true;
      }
    });

    if (tracks.length === 0) return '';

    // Expose for external integrations
    window.MIXTAPE_DEMO = {
      id: lollipop.currentToken, title: title, skin: skin,
      mysteryMode: mysteryMode,
      viewLink: tracks.length ? (tracks[0].externalUrl || '') : '',
      tracks: tracks.map(function(t) {
        return {
          artist: t.artist || '', title: t.title || '',
          displayTitle: (t.artist ? t.artist + ' - ' : '') + (t.title || ''),
          youtubeVideoId: t.youtubeVideoId || '',
          durationSeconds: t.durationSeconds || 0,
          externalUrl: t.externalUrl || ''
        };
      })
    };

    var id = 'mx-' + Math.random().toString(36).slice(2, 7);

    // Queue player init — DOM doesn't exist yet, displayLink will trigger
    lollipop._mixtapeQueue.push({ id: id, tracks: tracks, mysteryMode: mysteryMode });

    // First track for initial render
    var t0    = tracks[0] || {};
    var thumb0 = 'https://i.ytimg.com/vi/' + (t0.youtubeVideoId || '') + '/mqdefault.jpg';
    var dur0   = t0.durationSeconds
      ? Math.floor(t0.durationSeconds / 60) + ':' + String(t0.durationSeconds % 60).padStart(2, '0')
      : '';
    // In mystery mode, the player starts with an explainer instead of the first
    // track; tracks reveal individually as they play (see _revealNowPlaying).
    var title0, sub0;
    if (mysteryMode) {
      title0 = 'Mystery Mixtape';
      sub0   = '▶ Press play — each song is revealed as it plays';
    } else {
      var artist0 = lollipop.escapeAttr(t0.artist || '');
      title0 = lollipop.escapeAttr(t0.title || '');
      sub0   = artist0 + (artist0 && dur0 ? ' · ' : '') + dur0;
    }

    // Track list rows
    var tracksHtml = tracks.map(function(track, i) {
      var thumb = 'https://i.ytimg.com/vi/' + (track.youtubeVideoId || '') + '/mqdefault.jpg';
      var s   = track.durationSeconds || 0;
      var dur = s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : '';
      var tTxt = mysteryMode ? '? ? ?' : lollipop.escapeAttr(track.title  || '');
      var aTxt = mysteryMode ? ''      : lollipop.escapeAttr(track.artist || '');
      var sub  = aTxt + (aTxt && dur ? ' · ' : '') + dur;
      // Tap experience: link to iOS app (deep link TBD)
      var tapAttr = tapEnabled
        ? ' data-tap-url="lollipop://mixtape/' + lollipop.escapeAttr(lollipop.currentToken) + '?track=' + i + '"'
        : '';

      return '<li class="mx-track' + (i === 0 ? ' mx-track-active' : '') + '"'
        + ' onclick="lollipop.mixtapeGoTo(\'' + id + '\',' + i + ')"'
        + tapAttr + ' data-index="' + i + '">'
        + '<img class="' + (mysteryMode ? 'mx-blur' : '') + '" src="' + thumb + '" alt="">'
        + '<div class="mx-track-info">'
        +   '<span class="mx-track-title">' + tTxt + '</span>'
        +   '<span class="mx-track-sub">' + sub + '</span>'
        + '</div>'
        + '<i class="fa-solid fa-play mx-track-play"></i>'
        + '</li>';
    }).join('');

    // Mixtape title uses the same heading color + font + alignment + size as every other section title.
    var headColor = '';
    var headFont  = '';
    var headAlign = 'center';
    var headSize  = '';
    try { headColor = lollipop.config.section[0].fields[1].value || ''; } catch(e) {}
    try { headFont  = lollipop.fontFamily(lollipop.config.section[0].fields[1].font); } catch(e) {}
    try { headAlign = lollipop.config.section[0].fields[1].align || 'center'; } catch(e) {}
    try { headSize  = lollipop.fontSizeFor('heading', lollipop.config.section[0].fields[1].textsize); } catch(e) {}
    var headPad = (headAlign === 'left') ? 'padding-left:1rem;' : (headAlign === 'right') ? 'padding-right:1rem;' : '';
    var titleStyle = 'display:block;text-align:' + headAlign + ';color:' + headColor
                   + (headFont ? ';font-family:' + headFont : '')
                   + (headSize ? ';font-size:' + headSize : '') + ';' + headPad;
    var titleHtml = title
      ? '<h3 class="mx-title" style="' + titleStyle + '">' + lollipop.escapeAttr(title) + '</h3>'
      : '';

    return '<section class="mixtape mb-6 ' + (classes || '') + '">'
      // Hidden YouTube target — positioned off-screen so it doesn't affect layout
      + '<div id="' + id + '-yt" class="mx-yt-frame"></div>'
      + titleHtml
      + (function() {
          var s = '';
          if (playerColor)     s += 'background-color:' + playerColor + ';';
          if (playerTextColor) s += 'color:' + playerTextColor + ';';
          return '<div class="mx-player"' + (s ? ' style="' + s + '"' : '') + '>';
        })()
      +   '<div class="mx-now-playing">'
      +     '<img id="' + id + '-thumb" class="mx-now-thumb' + (mysteryMode ? ' mx-blur' : '') + '" src="' + thumb0 + '" alt="">'
      +     '<div class="mx-now-info">'
      +       '<span id="' + id + '-title" class="mx-now-title">' + title0 + '</span>'
      +       '<span id="' + id + '-sub"   class="mx-now-sub">'   + sub0   + '</span>'
      +     '</div>'
      +     '<div class="mx-controls">'
      +       '<button class="mx-btn" onclick="lollipop._mixtapePrev(\'' + id + '\')">'
      +         '<i class="fa-solid fa-backward-step"></i>'
      +       '</button>'
      +       '<button class="mx-btn mx-btn-play" id="' + id + '-play" onclick="lollipop.mixtapePlay(\'' + id + '\')">'
      +         '<i class="fa-solid fa-play"></i>'
      +       '</button>'
      +       '<button class="mx-btn" onclick="lollipop._mixtapeNext(\'' + id + '\')">'
      +         '<i class="fa-solid fa-forward-step"></i>'
      +       '</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="mx-progress">'
      +     '<div class="mx-progress-track" id="' + id + '-bar" onclick="lollipop.mixtapeSeek(\'' + id + '\', event)">'
      +       '<div class="mx-progress-fill" id="' + id + '-fill"></div>'
      +     '</div>'
      +     '<span class="mx-time" id="' + id + '-time">0:00 / 0:00</span>'
      +     '<div class="mx-volume" onclick="event.stopPropagation()">'
      +       '<i class="fa-solid fa-volume-off mx-vol-icon"></i>'
      +       '<input type="range" class="mx-vol" id="' + id + '-vol" min="0" max="100" value="80"'
      +         ' oninput="lollipop.mixtapeVolume(\'' + id + '\', this.value)">'
      +       '<i class="fa-solid fa-volume-high mx-vol-icon"></i>'
      +     '</div>'
      +   '</div>'
      +   '<ul class="mx-tracklist" id="' + id + '-list">' + tracksHtml + '</ul>'
      + '</div>'
      + '</section>';
  },

  build_section: function(section,classes){
    if (section.slug == 'settings'){
      return ``;
    }else{
      var buttoncolor = '#f7f7f7';
      var textcolor = '#222222';
      var html = `<section class="`+section.type+` `+classes+`" style="color: `+lollipop.config.section[0].fields[2].value+`">`;

      section.fields.forEach(function(field){
        if (field.method == 'buttoncolor'){
          buttoncolor = field.value;
        }else if (field.method == 'textcolor'){
          textcolor = field.value;
        }else{
          field['buttoncolor'] = buttoncolor;
          field['textcolor'] = textcolor;
          html += lollipop['field_'+ field.type](field, field.class);
        }
      });

      html += '</section>';
      return html;
    }
  },

  build_collectibles: function(section, classes){
    if (section.fields[3].value == true) {
      classes = '';
    }

    var html = `<section class="mb-6 relative `+classes+`" style="color: `+lollipop.config.section[0].fields[2].value+`">`;
    var swipe = section.fields[3].value;
    var size = section.fields[2].value;
    var round = section.fields[5].value;
    var slug = Math.random().toString(36).slice(2);

    section.fields.forEach(function(field){
      if (field.type == 'wallet'){
        field.slug = slug;
        field.swipe = swipe;
        field.round = round;
        field.size = size;
      }

      html += lollipop['field_'+ field.type](field, field.class);
    });

    html += '</section>';

    return html;
  },

  build_gallery: function(section, classes){
    // Look fields up by role so the layout survives field re-ordering.
    var sizeField    = section.fields.find(function(f){ return f.type === 'imagesize'; });
    var swipeField   = section.fields.find(function(f){ return f.method === 'swipe'; });
    var masonryField = section.fields.find(function(f){ return f.method === 'masonry'; });

    var size    = (sizeField && sizeField.value) || 'medium';
    var swipe   = !!(swipeField && swipeField.value === true);
    var masonry = !!(masonryField && masonryField.value === true);
    var slug    = Math.random().toString(36).slice(2);

    // Masonry and the square carousel both want a full-bleed, card-less section.
    if (masonry || swipe) { classes = ''; }

    var html = `<section class="mb-6 relative `+classes+`" style="color: `+lollipop.config.section[0].fields[2].value+`">`;
    section.fields.forEach(function(field){
      if (field.type == 'gallery'){
        field.slug    = slug;
        field.swipe   = swipe;
        field.size    = size;
        field.masonry = masonry;
      }
      html += lollipop['field_'+ field.type](field, field.class);
    });
    html += '</section>';
    return html;
  },

  build_team: function(section, classes){
    // Pass the "round headshots?" + bio-alignment choices through to the team field.
    var roundField = section.fields.find(function(f){ return f.method === 'round'; });
    var alignField = section.fields.find(function(f){ return f.type === 'textalign'; });
    var round = !(roundField && roundField.value === false); // default round
    var bioAlign = (alignField && alignField.align) || 'center';

    var html = `<section class="mb-6 relative `+classes+`" style="color: `+lollipop.config.section[0].fields[2].value+`">`;
    section.fields.forEach(function(field){
      if (field.type == 'team'){
        field.round = round;
        field.bioAlign = bioAlign;
      }
      html += lollipop['field_'+ field.type](field, field.class);
    });
    html += '</section>';
    return html;
  },

  build_preview: function(section,classes){
    if (section.fields[6].value == true) {
      classes = '';
    }

    var html = `<section class="`+section.fields[1].value+` mb-6 relative `+classes+`" style="color: `+lollipop.config.section[0].fields[2].value+`">`;
    var buttoncolor = '#f7f7f7';
    var textcolor = '#222222';
    var swipe = section.fields[6].value;
    var size = section.fields[2].value;
    var slug = section.fields[1].value;
    var chain = section.fields[1].chain;

    lollipop.analyticsTrack('collection_preview_view', {
      section_id: section.id || null,
      section_type: section.type || 'preview',
      field_type: 'collection_preview',
      field_title: slug || null,
      target_url: section.fields[5] ? section.fields[5].value : null,
      meta: {
        slug: slug || null,
        chain: chain || null,
        swipe: section.fields[6] ? section.fields[6].value : null
      }
    });

    section.fields.forEach(function(field){
      field.slug = slug;
      field.chain = chain;
      field.size = size;

      if (field.type == 'slug' && swipe == false){
        field.class = size +' gap-2 grid nfts-grid ' + field.class;
      }

      if (field.method == 'buttoncolor'){
        buttoncolor = field.value;
      }else if (field.method == 'textcolor'){
        textcolor = field.value;
      }else{
        field['buttoncolor'] = buttoncolor;
        field['textcolor'] = textcolor;
        html += lollipop['field_'+ field.type](field, field.class);
      }
    });

    html += '</section>';

    const col = fetch(this.apiurl+`/collection/`+chain+`/`+ slug)
      .then((res) => res.json())
      .then((res) => {
        $('#nfts-'+slug).html('');
        var tokenHTML = ``;

        if (swipe == false) {
          $('#nfts-'+slug).append('');
          res.nfts.forEach(function(nft){
            nft.chain = chain;
            if (nft.image_url != null) {
              var field = {};
              field.size = size;

              var image = $(lollipop.build_nft(field,nft));
              $('#nfts-'+slug).append(image);
            }
          });
        }else{
          $('#nfts-'+slug).addClass(size);
          var $carousel = $('#nfts-'+slug).flickity({ setGallerySize: false, wrapAround: true, autoPlay: true})
            .flickity('next')
            .flickity('select', 0);

          res.nfts.forEach(function(nft){
            nft.chain = chain;
            if (nft.image_url != null) {
              var field = {};
              field.size = size;
              tokenHTML = $(lollipop.build_nft(field,nft));
              $carousel.flickity('append', tokenHTML);
            }

            setTimeout(() => {
              $('.slider').flickity({imagesloaded: true});
            }, "2000");
          });
        }
      }).catch((e) => {
        console.error(e);
      });

    return html;
  },

  fixURL: function(url){
    var parser = document.createElement('a');
    var ipfs = ['ipfs.io', 'dweb.link','w3s.link'];
    parser.href = url;

    if (parser.pathname.includes("ipfs")) {
      return "https://"+ipfs[Math.floor(Math.random() * ipfs.length)] + parser.pathname;
    }else if(parser.protocol.includes("ipfs")){
      return parser.href.replace('ipfs://',"https://"+ipfs[Math.floor(Math.random() * ipfs.length)] +"/ipfs/");
    }else{
      return url;
    }
  },

  displayLink: function(col){
    const collectionCard = document.createElement('div');
    collectionCard.classList.add('card');

    if(col.section[0].fields[0].value == '#ffffff'){
      collectionCard.classList.add('pvc-white');
    }else{
      collectionCard.classList.add('pvc-white-bg');
    }

    collectionCard.classList.add(col.section[0].fields[0].value);
    collectionCard.classList.add('collection');
    collectionCard.style.backgroundColor = col.section[0].fields[0].value;
    collectionCard.style.color = col.section[0].fields[2].value;

    const groupContainer = document.getElementById('wrapper');

    col.section.forEach(function(section, index){
      try{
        collectionCard.innerHTML += lollipop['build_'+section.type](section, section.class);
      }catch{console.log("ERROR in section build ", section)}
    });

    groupContainer.appendChild(collectionCard);

    // Body font lives on global settings fields[2].font — applied to the card only.
    var fontClasses = ['indie','lato','lobster','specialelite','fredericka'];
    var bodyFont = '';
    try { bodyFont = col.section[0].fields[2].font || ''; } catch(e) {}
    var card = groupContainer.querySelector('.collection');
    if (card) {
      fontClasses.forEach(function(f) { card.classList.remove(f); });
      card.classList.add(bodyFont || 'lato');
    }

    // DOM is live — load YouTube API and init any queued mixtape players
    lollipop._loadYouTubeAPI();
    if (window.YT && window.YT.Player) {
      lollipop._mixtapeQueue.forEach(function(p) {
        lollipop._initMixtapePlayer(p.id, p.tracks, p.mysteryMode);
      });
      lollipop._mixtapeQueue = [];
    }

    lollipop.analyticsBindClicks();
    lollipop.bind_gallery_lightbox();

    lollipop.loading = false;

    setTimeout(() => {
      var $carousel = $('.slider').flickity({ setGallerySize: false, wrapAround: true, autoPlay: true})
        .flickity('next')
        .flickity('select', 0);
    }, "1000");
  },

  youtubeID: function(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = (url || '').match(regExp);

    return (match && match[2].length === 11)
      ? match[2]
      : null;
  },

  // Get the average RGB of an image to change headers and stuff. :)
  getAverageRGB: function(url) {
    var imgEl = new Image();

    imgEl.onload = function(){
      imgEl.crossOrigin = "anonymous";
      imgEl.src = url;
    };

    var blockSize = 5,
      defaultRGB = {r:0,g:0,b:0},
      canvas = document.createElement('canvas'),
      context = canvas.getContext && canvas.getContext('2d'),
      data,
      width,
      height,
      i = -4,
      length,
      rgb = {r:0,g:0,b:0},
      count = 0;

    if (!context) {
      return defaultRGB;
    }

    height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
    width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;

    context.drawImage(imgEl, 0, 0);
    context.crossOrigin = "Anonymous";

    try {
      data = context.getImageData(0, 0, width, height);
    } catch(e) {
      return defaultRGB;
    }

    length = data.data.length;

    while ( (i += blockSize * 4) < length ) {
      ++count;
      rgb.r += data.data[i];
      rgb.g += data.data[i+1];
      rgb.b += data.data[i+2];
    }

    rgb.r = ~~(rgb.r/count);
    rgb.g = ~~(rgb.g/count);
    rgb.b = ~~(rgb.b/count);

    return rgb;
  }
};
