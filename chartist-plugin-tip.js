/**
 * Chartist.js plugin to display nice tooltips
 *
 * todo:
 * - allow multiple series
 *
 * bug:
 * - if first series has missing data, tooltips for other series are missing as well => chartElement.find('.ct-series:first-child .ct-point')
 * - show tip on the highest value point
 */
( function( window, document, Chartist )
{
    'use strict';

    var defaultOptions = {
        title     : ":title on :date",
        columns   : [],
        chartType : null,
    };

    var getSeriesChar = function( count )
    {
        var alph = 'abcdefghijklmnopqrstuvwxyz';

        return alph.substr( count, 1 );
    };

    var getChartType = function( chart )
    {
        if ( chart instanceof Chartist.Line ) return 'line';

        if ( chart instanceof Chartist.Bar ) return 'bar';

        if ( chart instanceof Chartist.Pie ) return 'pie';

        return 'undefined';
    };

    Chartist.plugins = Chartist.plugins || {};

    Chartist.plugins.ctTip = function( userOptions )
    {
        var options = Chartist.extend( {}, defaultOptions, userOptions );

        return function ctTip( chart )
        {
            options.chartType = getChartType( chart );

            // no support for other types than line and bar
            if ( options.chartType !== 'line' && options.chartType !== 'bar' ) return;

            var chartElement = $(chart.container);
            var positions    = [];

            /**
             * Builds a new tooltip
             *
             * @param  {object} data
             * @return {string}
             */
            var buildTooltip = function( pointData )
            {
                var tipWidth = 240;
                var tip      = $('<div class="ct-tip" id="ct-tip-' + pointData.data.id + '" />');
                var title    = typeof pointData.data.tooltip !== 'undefined' ? pointData.data.tooltip : pointData.data.title;
                var series   = pointData.data;

                var title = window.searchReplace( options.title, /:([a-z]*)/ig, pointData.data[0] );// options.title.replace( ':value', pointData.data.tooltip );
                    // title = title !== null ? title.replace( ':title', pointData.data.title ) + ' ' : '';

                var tableHeadRow = $('<tr />');

                for ( var i = 0; i < options.columns.length; i++ )
                {
                    var size   = typeof options.columns[i].size === 'undefined' ? 100 / options.columns.length : options.columns[i].size;
                    var column = $('<th width="' + size + '%">' + options.columns[i].title + '</th>');

                    tableHeadRow.append( column );
                }

                var tableHead = $('<thead />').append( tableHeadRow );
                var tableBody = $('<tbody />');

                for ( var s = 0; s < series.length; s++ )
                {
                    var tableBodyRow = $('<tr />');

                    for ( var i = 0; i < options.columns.length; i++ )
                    {
                        var legend = '';
                        var legendClass = '';

                        if ( i === 0 )
                        {
                            legend = '<span class="ct-tip-legend"></span>';
                            legendClass ='ct-tip-series-' + getSeriesChar( s );
                        }

                        var value  = series[s][options.columns[i].value];
                        var column = $('<td class="' + legendClass + '">' + legend + ( isNaN( value ) ? value : ( parseFloat( value ).toFixed( 2 ) ) ) + '</td>');

                        tableBodyRow.append( column );
                    }

                    tableBody.append( tableBodyRow );
                }

                var table = $('<table class="ct-tip-data-table" />').append( tableHead ).append( tableBody );

                tip.append( $('<h6 class="ct-tip-title">' + title + '</h6>') );
                tip.append( $('<div class="ct-tip-stats" />').append( table ) );
                tip.append( $('<div class="ct-tip-arrow" />') );

                var left   = pointData.element.offset().left - chartElement.offset().left;
                var bottom = chartElement.height() - ( pointData.element.offset().top - chartElement.offset().top ) + 10;

                // consider half width of tooltip
                var diff = left - ( tipWidth / 2 );

                if ( diff < 0 )
                {
                    left = left + ( ( diff * -1 ) + 10 );

                    tip.children('.ct-tip-arrow').css({ left: ( tipWidth / 2 ) - ( diff * -1 ) - 10 });
                }
                else if ( ( left + ( tipWidth / 2 ) ) > chartElement.outerWidth() )
                {
                    var newLeft = left - ( ( left + ( tipWidth / 2 ) ) - chartElement.outerWidth() );
                        diff    = left - newLeft;
                        left    = newLeft;

                    tip.children('.ct-tip-arrow').css({ left: tip.children('.ct-tip-arrow').offset().left + ( tipWidth / 2 ) + diff });
                }

                // no idea why, but firefox needs its own positions
                if ( window.isFirefox )
                {
                    left   = left + 3;
                    bottom = bottom - 3;
                }

                if ( options.chartType === 'bar' )
                {
                    var width = parseFloat( pointData.element.css('stroke-width').replace('px', '') );
                    left = left + ( width / 2 ) + 5;
                }

                tip.css({
                    bottom: bottom,
                    left: left,
                });

                return tip;
            };


            /**
             * Created event
             *
             * @param  {object} data
             * @return {null}
             */
            chart.on('created', function (data) {
                var ctTipData   = data.options.ctTipData;
                var count       = 1;
                var lastObject  = null;
                var length      = chartElement.find('.ct-point').length;
                var farLeft     = 0;
                var farRight    = 0;
                // be aware of the different positions of the chart line,
                // its grid and the actual mouse position which is the position
                // inside of the element, on which the event is called
                var difference  = chartElement.find('.ct-chart-' + options.chartType).offset().left

                var maxRight = chartElement.width();
                // var series   = chart.data.series.shift();
                var series   = ctTipData;
                var times    = Object.keys( ctTipData );

                positions = [];

                // remove first empty key
                if ( typeof series.data !== 'undefined' && typeof series.data[0] === 'undefined' )
                {
                    series.data.shift();
                }

                var elementClass = options.chartType === 'line' ? 'ct-point' : 'ct-bar';

                chartElement.find('.ct-series:first-child .' + elementClass).each( function()
                {
                    var fromX  = 0;
                    var toX    = maxRight;
                    var center = 0;
                    var time   = times.shift();

                    // now second element and all others
                    if ( lastObject !== null )
                    {
                        center = ( ( $(this).offset().left - difference ) - ( positions[lastObject].element.offset().left - difference ) ) / 2;

                        // set the previous TO position
                        positions[lastObject].toX = ( positions[lastObject].element.offset().left - difference ) + center;

                        // set current FROM position
                        fromX = positions[lastObject].toX;

                        // last point should not go to the end to prevent
                        // breaking mouse actions near the end of the chart
                        if ( count === length && ( $(this).offset().left - difference ) > toX )
                        {
                            toX -= center;
                        }
                    }

                    var point = {
                        type    : options.chartType,
                        fromX   : fromX,
                        toX     : toX,
                        element : $(this),
                        time    : time,
                        data    : ctTipData[time],
                    };

                    count++;
                    positions[time] = point;
                    lastObject      = time;

                    farRight = toX;
                });

                var line = chartElement.find('.ct-chart-' + options.chartType);

                if ( ! line.length ) return;

                $(line[0]).on( 'mousemove', function( event )
                {
                    var x = event.pageX - $(this).offset().left;

                    if ( x < farLeft || x > farRight )
                    {
                        $('.ct-tip').remove();

                        return true;
                    }

                    for ( var key in positions )
                    {
                        if ( positions[key].fromX > x || positions[key].toX < x ) continue;

                        var tipElement = $( '#ct-tip-' + positions[key].data[0].id );

                        if ( tipElement.length ) break;

                        $('.ct-tip').remove();

                        var tip = buildTooltip( positions[key] );

                        chartElement.append(tip);
                        tip.show();
                    }
                });

                $(line[0]).on( 'mouseleave', function( event )
                {
                    setTimeout( function()
                    {
                        if ( $('.ct-tip:hover').length ) return true;

                        $('.ct-tip').remove();
                    }, 10 );
                });
            });
        };
    };
} ( window, document, Chartist ) );