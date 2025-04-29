
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
      // $('#wrapper').html('').removeClass('invisible');
      this.validatelollipop();
      
      }
     
    },
    getUrlVars: function()
    {
      var vars = [], hash;
      var regexp = /#\S+/g;
      
      var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

      for(var i = 0; i < hashes.length; i++)
      {
          hash = hashes[i].split('=');

          vars.push(hash[0]);
          try{
            vars[hash[0]] = hash[1].replace(regexp, '').replace('#','');
          }catch{
            
          }
          
      }
      return vars;
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
}
        lollipop.config = await fetch(`/`+dir+`/`+this.currentToken+`.json?ver=`+Date.now(),opts)
        .then((res) => res.json())
        .then((res) => {
          try{

          $('.command').html('<span class="spin">👾</span> Found lollipop! Grabbing Data...');
          $('.sunburst > img').attr('src', res.image_url);
          $('.sunburst').removeClass('blueberry').addClass('vanilla');
          window.col = res;
        this.build_config(res);
        this.displayNFT(res);
        $('#wrapper').removeClass('invisible');
          return res
          }catch{
            throw "Config File not found.";
          }
          
        })
        .catch((e) => {
          if (lollipop.currentToken != '' && window == window.parent) {
            window.location.href = "https://lollipop.gg/build.html?t="+ lollipop.currentToken;
            
          }else if( window !== window.parent && this.iframe == true) {
              $('.command').html('<span class="spin">🍭</span>Please complete setup to the right.<br><br> or try to <a href="#" onClick="window.location.reload()">Reload</a>');
              // window.location.reload()
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
          
          console.error(e)
          console.error('Could not find the IPFS config')
          return null
        });


    },
     build_config: function(config){
         var newconfig = []
         var count = 0
         config.section.forEach(function(section){
            var fc = 0
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
                  }else if(section.name.includes("Preview")){
                    section.id = "section_collection_preview";
                  }else if(section.name.includes("Youtube")){
                    section.id = "section_youtube";
                  }else if(section.name.includes("Footer")){
                    section.id = "section_footer";
                  }else{
                    console.log('Help I need a Dev to Fix me! ASAP', section);
                  }
                }
            section.fields.forEach(function(field){
              //This is Legacy and only needed after first 20 or so convert to new configs. 
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
              }catch{

              }
                
                
            })
            config.section[count].fields = fields;
            config.section[count] = Object.assign({},schema[section.id], section);
            count++;
           
         });
         window.lollipop.config = config;
    },
    field_background: function(field, classes){
      return `<div class="`+ classes +`" style="background-image: url(`+field.value+`)"></div>`
    },
    field_url: function(field, classes){
      return `<a href="`+field.value+`"></a>`;
    },
    field_color: function(field, classes){
      return ``;
    },
    field_card_color: function(field, classes){
      return ``;
    },
    field_image: function(field, classes){
      return `<img class="`+ classes +`" src="`+field.value+`" alt="">`
    },
    field_text: function(field, classes){
      return `<p class="`+ classes +`">`+ field.value +`</p>`
    },
    field_header: function(field, classes){
      return `<h3 class="text-center  `+ classes +`" style="color:`+col.section[0].fields[1].value+`">`+field.value+`</h3>`;
    },
    field_link: function(field, classes){
      var text = field.title

      return `<a href="`+ field.value +`" target="_blank" name="`+field.title+`">`+ text +`</a>`;
    },
    field_buttonlink: function(field,classes){
      var text = field.title
      return `<a target="_blank" href="`+field.value+`" style="background-color:`+field.buttoncolor+`; color:`+field.textcolor+` " class="`+ classes+` inline-block w-full mb-2 bg-gray-300  text-gray-800 font-bold py-2 px-4 rounded-xl text-center items-center">
      <span>`+text+`</span>
      </a>`;
    },
    field_iconlink: function(field, classes){
      var text = field.title
      text = `<i class="`+ classes +` text-4xl"></i>`;
      return `<a href="`+ field.value +`" target="_blank" name="`+field.title+`">`+ text +`</a>`;
    },
    field_textbox: function(field, classes){
      return `<div class="px-4 mb-8 lato  `+classes+`">`+ field.value +`</div>`;
    },
    field_text: function(field, classes){
      return `<p class="px-4 mb-8 lato  `+classes+`">`+ field.value +`</p>`;
    },
    field_youtube: function(field, classes){
      var videoId = this.youtubeID(field.value);
      if(field.value.includes('autoplay')){
        videoId = videoId + "?&autoplay=1&mute=1"
      }
      return `<iframe allow="autoplay" class="mb-8 px-4 w-full  `+classes+`" style="height:calc(100vw/2); max-height:450px" src="//www.youtube.com/embed/` + videoId + `" frameborder="0" allowfullscreen></iframe>`;
    },
    field_tweet: function(field, classes){
      var src = 'https://platform.twitter.com/widgets.js';
            var s = document.createElement( 'script' );
              s.setAttribute( 'src', src );
              document.body.appendChild( s );
        return `<div class="mx-4 mb-8 justify-center content-center flex  `+classes+`"><blockquote class="twitter-tweet m-auto `+ classes +`">
              <a href="`+ field.value +`"></a> 
              </blockquote></div>`;
    },
    field_tags: function(field, classes){
        var count = 0;
        var html = `<div class="tags mx-2 mb-8 `+classes+`">`;
        if (Array.isArray(field.value) == false){
          field.value = field.value.split(",");
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
        html += `</div>`
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
      var nfts = `<div id="nfts-`+field.slug+`" data-slug="`+field.slug+`" class="`+field.class+` `+swipe+` `+field.size+` p-2 nfts w-full mb-6">`
      field.value.forEach(function(nft){
        nfts += lollipop.build_nft(field,nft);
      });
      nfts += "</div>";
      return nfts;
    },
    field_button: function(field, classes){
      return `<a style="background-color:`+field.buttoncolor+`; color:`+field.textcolor+` " class="block text-center mx-8 my-2 p-2 rounded-xl hover:opacity-100 opacity-75" href="`+field.value+`">`+field.title+`</a>`;
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
          // var $carousel = $('#nfts').flickity();
      }).catch((e) => {
        console.error(e);
      });
      var html = `<div class="`+field.slug+` `+classes+` w-full grid grid-cols-3 gap-0 w-100 h-12 text-center border-black">
                  <div class="grid place-content-center text-center col-start-1 col-end-1"><span class="uniqueHolders font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">Holders</div></div>
                  <div class="grid place-content-center col-start-2 border-l col-end-2"><span class="totalSupply font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">Supply</div></div>
                  <div class="grid place-content-center col-start-3 border-l col-end-3"><span class="floor font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">Floor</div></div>
                </div>`
      }else{
      var html = `<div class="`+field.slug+` `+classes+` w-full grid grid-cols-2 gap-0 w-100 h-12 text-center border-black">
                  <div class="grid place-content-center text-center col-start-1 col-end-1"><span class="uniqueHolders font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">lollipops</div></div>
                  <div class="grid place-content-center col-start-2 border-l col-end-2"><span class="totalSupply font-bold specialelite" style="color:`+col.section[0].fields[1].value+`">-</span><div class="text-xs lato">Collectibles</div></div>
                </div>`
      }

      return html;
    }
    },
    show_nft: function(){

      var nft = $(event.target).parent().data('nft');
      console.log(lollipop.nfts[nft]);

      $("#nftModal img").attr('src',lollipop.nfts[nft].image_url);
      $("#nftModal title").html(lollipop.nfts[nft].name);
      $("#nftModal lollipop").html(lollipop.nfts[nft].collection);
      $("#nftModal .permalink").attr('href',lollipop.nfts[nft].permalink);
      console.log(lollipop.nfts[nft])
      if(lollipop.nfts[nft].chain == 'ETH'){
        $("#nftModal .permalink").html('<i class="ict-brands ict-opensea text-blue-800"></i> <span class="flex-1 text-lg pr-8">View on Opensea</span>').removeClass('bg-gray-900 text-white rounded-xl').addClass('bg-gray-300 text-gray-900 rounded-full');
      }else{
        $("#nftModal .permalink").html('<i class="ml-6 text-xl ict-brands ict-me"></i> <span class="flex-1 text-base pr-6 elite pt-1">View on MagicEden</span>').removeClass('bg-gray-300 text-gray-900 rounded-full').addClass('bg-gray-900 text-white rounded-xl');

      }
      $("#nftModal").modal({
          fadeDuration: 1000,
          fadeDelay: 0.50
        });
      console.log(nft);
    },
    verify_nft: async function(slug,nft){
      // var url = 'https://api-mainnet.magiceden.dev/v2/tokens/';
      // if(nft.chain == 'ETH'){
      //   url = 'https://api.opensea.io/api/v1/asset/0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb/1/?include_orders=false';
      // }
      // const stats = fetch(this.apiurl+`/collection/`+field.chain+`/`+ field.slug+`/stats`)
      //   .then((res) => res.json())
      //   .then((res) => {
      //     $('.'+field.slug+' .totalSupply').html(res.totalSupply);
      //     $('.'+field.slug+' .uniqueHolders').html(res.uniqueHolders);
      //     $('.'+field.slug+' .floor').html(res.floor);
      //     // var $carousel = $('#nfts').flickity();
      // }).catch((e) => {
      //   console.error(e);
      // });

    },
    build_nft: function(field,nft){
      var slug = Math.random().toString(36).slice(2);
      this.nfts[slug] = nft;
      // verify_nft(slug,nft);
      var rounded = "rounded-xl";
      if(field.round == true){
        rounded = "rounded-full";
      }

      return `<span onClick="lollipop.show_nft()" data-nft='`+slug+`' class="nft relative `+field.class+`">
                <img class="`+field.size+` autoFix `+rounded+`" src="`+nft.image_url+`">
                <span class="verified badge whitespace-nowrap w-6 h-6 overflow-hidden absolute bottom-0 left-0 opacity-50 bg-black text-white indie text-xs rounded-full p-1 m-1"><i class="fa-solid fa-ice-cream text-white mr-1"></i></span>
              </span>`
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
       var html = `<div class=" `+classes+` `+layout+` px-4  mb-6 links text-center items-center justify-center social">`;
       html += iconhtml;
       html += `</div>`;
       return html;
    },

    build_section: function(section,classes){
      if (section.slug == 'settings'){
        return ``;
      }else{
        var buttoncolor = '#f7f7f7';
        var textcolor = '#222222';
        var html = `<section class="`+section.type+`  `+classes+`" style="color: `+lollipop.config.section[0].fields[2].value+`">`;
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
      //if this is not a slide element lets remove classes
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

    build_preview: function(section,classes){
      //if this is not a slide element lets remove classes
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
        section.fields.forEach(function(field){
          field.slug = slug;
          field.chain = chain;
          field.size = size

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
          // Swipe on mobile check
          if (swipe == false) {
            $('#nfts-'+slug).append('');
            res.nfts.forEach(function(nft){
              nft.chain = chain;
            if (nft.image_url != null) {
              // size class
              var field = {};
              field.size = size;

              var image = $(lollipop.build_nft(field,nft));
              $('#nfts-'+slug).append(image);
              
            }

          });
            // $('#nfts-'+section.fields[1].value).append('</div>');
          }else{
          $('#nfts-'+slug).addClass(size);
          var $carousel = $('#nfts-'+slug).flickity({ setGallerySize: false,  wrapAround: true, autoPlay: true})
                            .flickity('next')
                            .flickity( 'select', 0 );
          res.nfts.forEach(function(nft){
            nft.chain = chain;
          // try{
            if (nft.image_url != null) {
              // var image = $(`<span class=""><img class="`+size+` autoFix  rounded-xl" src="`+nft.image_url+`"><span class="">`)
              // $('#nfts-'+slug).append(image);
              var field = {};
              field.size = size;
              tokenHTML = $(lollipop.build_nft(field,nft));
              $carousel.flickity( 'append', tokenHTML );
            }
            setTimeout(() => {
               $('.slider').flickity({imagesloaded: true});
            }, "2000")
           
            // $('#nfts').append(tokenHTML);
          // }catch{

          // }
          
          });


                      
          }
          
          // var $carousel = $('#nfts').flickity();
      }).catch((e) => {
        console.error(e);
      });

    return html;
      
    },
    fixURL: function(url){
      var parser = document.createElement('a');
      var ipfs = ['ipfs.io', 'dweb.link','w3s.link']
      parser.href = url;

      parser.protocol; // => "http:"
      parser.hostname; // => "example.com"
      parser.port;     // => "3000"
      parser.pathname; // => "/pathname/"
      parser.search;   // => "?search=test"
      parser.hash;     // => "#hash"
      parser.host;     // => "example.com:3000"
        if (parser.pathname.includes("ipfs")) {
          return "https://"+ipfs[Math.floor(Math.random() * ipfs.length)] + parser.pathname;
        }else if(parser.protocol.includes("ipfs")){
          return parser.href.replace('ipfs://',"https://"+ipfs[Math.floor(Math.random() * ipfs.length)] +"/ipfs/");
        }else{
           return url;
        }
      
    },
    displayNFT: function(col){
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

      col.section.forEach(function(section){
        collectionCard.innerHTML += lollipop['build_'+section.type](section, section.class);
      });
      console.log('we are adding the Card to the div');
      groupContainer.appendChild(collectionCard);
      lollipop.loading = false;
      setTimeout(() => {
                     var $carousel = $('.slider').flickity({ setGallerySize: false,  wrapAround: true, autoPlay: true})
                            .flickity('next')
                            .flickity( 'select', 0 );
            }, "1000")
      
    },
    youtubeID: function(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);

        return (match && match[2].length === 11)
          ? match[2]
          : null;
    },

// Get the average RGB of an Image to change headers and stuff. :) 
 getAverageRGB: function(url) {
 var imgEl=new Image();
    imgEl.onload=function(){
          imgEl.crossOrigin="anonymous";
    imgEl.src=url;
    }



    var blockSize = 5, // only visit every 5 pixels
        defaultRGB = {r:0,g:0,b:0}, // for non-supporting envs
        canvas = document.createElement('canvas'),
        context = canvas.getContext && canvas.getContext('2d'),
        data, width, height,
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
        /* security error, img on diff domain */alert('x');
        return defaultRGB;
    }
    
    length = data.data.length;
    
    while ( (i += blockSize * 4) < length ) {
        ++count;
        rgb.r += data.data[i];
        rgb.g += data.data[i+1];
        rgb.b += data.data[i+2];
    }
    
    // ~~ used to floor values
    rgb.r = ~~(rgb.r/count);
    rgb.g = ~~(rgb.g/count);
    rgb.b = ~~(rgb.b/count);
    
    return rgb;
}
}



