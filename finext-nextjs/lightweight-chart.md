Lightweight Charts™ Documentation

Getting started

Requirements

Lightweight Charts™ is a client-side library that is not designed to work on the server side, for example, with Node.js.

The library code targets the ES2020 language specification. Therefore, the browsers you work with should support this language revision. Consider the following table to ensure the browser compatibility.

To support previous revisions, you can set up a transpilation process for the lightweight-charts package in your build system using tools such as Babel. If you encounter any issues, open a GitHub issue with detailed information, and we will investigate potential solutions.

Installation

To set up the library, install the lightweight-charts npm package:

npm install --save lightweight-charts


The package includes TypeScript declarations, enabling seamless integration within TypeScript projects.

Build variants

The library ships with the following build variants:

Dependencies included

Mode

ES module

IIFE (window.LightweightCharts)

No

PROD

lightweight-charts.production.mjs

N/A

No

DEV

lightweight-charts.development.mjs

N/A

Yes (standalone)

PROD

lightweight-charts.standalone.production.mjs

lightweight-charts.standalone.production.js

Yes (standalone)

DEV

lightweight-charts.standalone.development.mjs

lightweight-charts.standalone.development.js

License and attribution

The Lightweight Charts™ license requires specifying TradingView as the product creator. You should add the following attributes to a public page of your website or mobile application:

Attribution notice from the NOTICE file

The https://www.tradingview.com link

Creating a chart

As a first step, import the library to your file:

import { createChart } from 'lightweight-charts';


To create a chart, use the createChart function. You can call the function multiple times to create as many charts as needed:

import { createChart } from 'lightweight-charts'; 
// ... 
const firstChart = createChart(document.getElementById('firstContainer'));
const secondChart = createChart(document.getElementById('secondContainer'));


As a result, createChart returns an IChartApi object that allows you to interact with the created chart.

Creating a series

When the chart is created, you can display data on it. The basic primitive to display data is a series. The library supports the following series types:

Area

Bar

Baseline

Candlestick

Histogram

Line

To create a series, use the addSeries method from IChartApi. As a parameter, specify a series type you would like to create:

import { AreaSeries, BarSeries, BaselineSeries, createChart } from 'lightweight-charts';

const chart = createChart(container);
const areaSeries = chart.addSeries(AreaSeries);
const barSeries = chart.addSeries(BarSeries);
const baselineSeries = chart.addSeries(BaselineSeries); 
// ... 


Note: A series cannot be transferred from one type to another one, since different series types require different data and options types.

Setting and updating data

When the series is created, you can populate it with data. Note that the API calls remain the same regardless of the series type, although the data format may vary.

Setting the data to a series

To set the data to a series, you should call the ISeriesApi.setData method:

const chartOptions = { layout: { textColor: 'black', background: { type: 'solid', color: 'white' } } };
const chart = createChart(document.getElementById('container'), chartOptions);
const areaSeries = chart.addSeries(AreaSeries, {
    lineColor: '#2962FF', topColor: '#2962FF',
    bottomColor: 'rgba(41, 98, 255, 0.28)',
});

areaSeries.setData([
    { time: '2018-12-22', value: 32.51 },
    { time: '2018-12-23', value: 31.11 },
    { time: '2018-12-24', value: 27.02 },
    { time: '2018-12-25', value: 27.32 },
    { time: '2018-12-26', value: 25.17 },
    { time: '2018-12-27', value: 28.89 },
    { time: '2018-12-28', value: 25.46 },
    { time: '2018-12-29', value: 23.92 },
    { time: '2018-12-30', value: 22.68 },
    { time: '2018-12-31', value: 22.67 },
]);

const candlestickSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
    wickUpColor: '#26a69a', wickDownColor: '#ef5350',
});

candlestickSeries.setData([
    { time: '2018-12-22', open: 75.16, high: 82.84, low: 36.16, close: 45.72 },
    { time: '2018-12-23', open: 45.12, high: 53.90, low: 45.12, close: 48.09 },
    { time: '2018-12-24', open: 60.71, high: 60.71, low: 53.39, close: 59.29 },
    { time: '2018-12-25', open: 68.26, high: 68.26, low: 59.04, close: 60.50 },
    { time: '2018-12-26', open: 67.71, high: 105.85, low: 66.67, close: 91.04 },
    { time: '2018-12-27', open: 91.04, high: 121.40, low: 82.70, close: 111.40 },
    { time: '2018-12-28', open: 111.51, high: 142.83, low: 103.34, close: 131.25 },
    { time: '2018-12-29', open: 131.33, high: 151.17, low: 77.68, close: 96.43 },
    { time: '2018-12-30', open: 106.33, high: 110.20, low: 90.39, close: 98.10 },
    { time: '2018-12-31', open: 109.87, high: 114.69, low: 85.66, close: 111.26 },
]);

chart.timeScale().fitContent();


You can also use setData to replace all data items.

Updating the data in a series

If your data is updated, for example in real-time, you may also need to refresh the chart accordingly. To do this, call the ISeriesApi.update method that allows you to update the last data item or add a new one.

import { AreaSeries, CandlestickSeries, createChart } from 'lightweight-charts';
const chart = createChart(container);
const areaSeries = chart.addSeries(AreaSeries);
areaSeries.setData([
     // Other data items
     { time: '2018-12-31', value: 22.67 },
]);
const candlestickSeries = chart.addSeries(CandlestickSeries);
candlestickSeries.setData([
     // Other data items
     { time: '2018-12-31', open: 109.87, high: 114.69, low: 85.66, close: 111.26 },
]); 
// ... 

// Update the most recent bar 
areaSeries.update({ time: '2018-12-31', value: 25 });
candlestickSeries.update({ time: '2018-12-31', open: 109.87, high: 114.69, low: 85.66, close: 112 }); 

// Creating the new bar 
areaSeries.update({ time: '2019-01-01', value: 20 });
candlestickSeries.update({ time: '2019-01-01', open: 112, high: 112, low: 100, close: 101 });


Note: We do not recommend calling ISeriesApi.setData to update the chart, as this method replaces all series data and can significantly affect the performance.

Series

This article describes supported series types and ways to customize them.

Supported types

Area

Series Definition: AreaSeries

Data format: SingleValueData or WhitespaceData

Style options: a mix of SeriesOptionsCommon and AreaStyleOptions

This series is represented with a colored area between the time scale and line connecting all data points:

const chartOptions = { layout: { textColor: 'black', background: { type: 'solid', color: 'white' } } };
const chart = createChart(document.getElementById('container'), chartOptions);
const areaSeries = chart.addSeries(AreaSeries, { lineColor: '#2962FF', topColor: '#2962FF', bottomColor: 'rgba(41, 98, 255, 0.28)' });
const data = [{ value: 0, time: 1642425322 }, { value: 8, time: 1642511722 }, { value: 10, time: 1642598122 }, { value: 20, time: 1642684522 }, { value: 3, time: 1642770922 }, { value: 43, time: 1642857322 }, { value: 41, time: 1642943722 }, { value: 43, time: 1643030122 }, { value: 56, time: 1643116522 }, { value: 46, time: 1643202922 }];
areaSeries.setData(data);
chart.timeScale().fitContent();


Bar

Series Definition: BarSeries

Data format: BarData or WhitespaceData

Style options: a mix of SeriesOptionsCommon and BarStyleOptions

This series illustrates price movements with vertical bars. The length of each bar corresponds to the range between the highest and lowest price values. Open and close values are represented with the tick marks on the left and right side of the bar, respectively:

const chartOptions = { layout: { textColor: 'black', background: { type: 'solid', color: 'white' } } };
const chart = createChart(document.getElementById('container'), chartOptions);
const barSeries = chart.addSeries(BarSeries, { upColor: '#26a69a', downColor: '#ef5350' });
const data = [  { open: 10, high: 10.63, low: 9.49, close: 9.55, time: 1642427876 },  { open: 9.55, high: 10.30, low: 9.42, close: 9.94, time: 1642514276 },  /* ... more data ... */ ];
barSeries.setData(data);
chart.timeScale().fitContent();


Baseline

Series Definition: BaselineSeries

Data format: SingleValueData or WhitespaceData

Style options: a mix of SeriesOptionsCommon and BaselineStyleOptions

This series is represented with two colored areas between the base value line and line connecting all data points:

const chartOptions = { layout: { textColor: 'black', background: { type: 'solid', color: 'white' } } };
const chart = createChart(document.getElementById('container'), chartOptions);
const baselineSeries = chart.addSeries(BaselineSeries, { baseValue: { type: 'price', price: 25 }, topLineColor: 'rgba( 38, 166, 154, 1)', topFillColor1: 'rgba( 38, 166, 154, 0.28)', topFillColor2: 'rgba( 38, 166, 154, 0.05)', bottomLineColor: 'rgba( 239, 83, 80, 1)', bottomFillColor1: 'rgba( 239, 83, 80, 0.05)', bottomFillColor2: 'rgba( 239, 83, 80, 0.28)' });
const data = [{ value: 1, time: 1642425322 }, { value: 8, time: 1642511722 }, /* ... */];
baselineSeries.setData(data);
chart.timeScale().fitContent();


Candlestick

Series Definition: CandlestickSeries

Data format: CandlestickData or WhitespaceData

Style options: a mix of SeriesOptionsCommon and CandlestickStyleOptions

This series illustrates price movements with candlesticks. The solid body of each candlestick represents the open and close values for the time period. Vertical lines, known as wicks, above and below the candle body represent the high and low values, respectively:

const chartOptions = { layout: { textColor: 'black', background: { type: 'solid', color: 'white' } } };
const chart = createChart(document.getElementById('container'), chartOptions);
const candlestickSeries = chart.addSeries(CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
const data = [{ open: 10, high: 10.63, low: 9.49, close: 9.55, time: 1642427876 }, /* ... */];
candlestickSeries.setData(data);
chart.timeScale().fitContent();


Histogram

Series Definition: HistogramSeries

Data format: HistogramData or WhitespaceData

Style options: a mix of SeriesOptionsCommon and HistogramStyleOptions

This series illustrates the distribution of values with columns:

const chartOptions = { layout: { textColor: 'black', background: { type: 'solid', color: 'white' } } };
const chart = createChart(document.getElementById('container'), chartOptions);
const histogramSeries = chart.addSeries(HistogramSeries, { color: '#26a69a' });
const data = [{ value: 1, time: 1642425322 }, { value: 8, time: 1642511722 }, /* ... */];
histogramSeries.setData(data);
chart.timeScale().fitContent();


Line

Series Definition: LineSeries

Data format: LineData or WhitespaceData

Style options: a mix of SeriesOptionsCommon and LineStyleOptions

This series is represented with a set of data points connected by straight line segments:

const chartOptions = { layout: { textColor: 'black', background: { type: 'solid', color: 'white' } } };
const chart = createChart(document.getElementById('container'), chartOptions);
const lineSeries = chart.addSeries(LineSeries, { color: '#2962FF' });
const data = [{ value: 0, time: 1642425322 }, { value: 8, time: 1642511722 }, /* ... */];
lineSeries.setData(data);
chart.timeScale().fitContent();


Custom series (plugins)

The library enables you to create custom series types, also known as series plugins, to expand its functionality. With this feature, you can add new series types, indicators, and other visualizations.

To define a custom series type, create a class that implements the ICustomSeriesPaneView interface. This class defines the rendering code that Lightweight Charts™ uses to draw the series on the chart. Once your custom series type is defined, it can be added to any chart instance using the addCustomSeries() method. Custom series types function like any other series.

Customization

Each series type offers a unique set of customization options listed on the SeriesStyleOptionsMap page. You can adjust series options in two ways:

Specify the default options using the corresponding parameter while creating a series:

// Change default top & bottom colors of an area series in creating time 
const series = chart.addSeries(AreaSeries, {
    topColor: 'red',
    bottomColor: 'green',
});


Use the ISeriesApi.applyOptions method to apply other options on the fly:

// Updating candlestick series options on the fly 
candlestickSeries.applyOptions({
    upColor: 'red',
    downColor: 'blue',
});


Chart types

Lightweight Charts offers different types of charts to suit various data visualization needs.

Standard Time-based Chart

The standard time-based chart is the most common type, suitable for displaying time series data.

Creation method: createChart

Horizontal scale: Time-based

Use case: General-purpose charting for financial and time series data

import { createChart } from 'lightweight-charts';
const chart = createChart(document.getElementById('container'), options);


This chart type uses time values for the horizontal scale and is ideal for most financial and time series data visualizations.

const chartOptions = { layout: { textColor: 'black', background: { type: 'solid', color: 'white' } } };
const chart = createChart(document.getElementById('container'), chartOptions);
// ... adding series and data


Yield Curve Chart

The yield curve chart is specifically designed for displaying yield curves, common in financial analysis.

Creation method: createYieldCurveChart

Horizontal scale: Linearly spaced, defined in monthly time duration units

Key differences:

Whitespace is ignored for crosshair and grid lines

Specialized for yield curve representation

import { createYieldCurveChart } from 'lightweight-charts';
const chart = createYieldCurveChart(document.getElementById('container'), options);


Use this chart type when you need to visualize yield curves or similar financial data where the horizontal scale represents time durations rather than specific dates.

Tip: If you want to spread out the beginning of the plot further and don't need a linear time scale, you can enforce a minimum spacing around each point by increasing the minBarSpacing option in the TimeScaleOptions. To prevent the rest of the chart from spreading too wide, adjust the baseResolution to a larger number, such as 12 (months).

const chartOptions = {
    layout: { textColor: 'black', background: { type: 'solid', color: 'white' } },
    yieldCurve: { baseResolution: 1, minimumTimeRange: 10, startTimeRange: 3 },
    handleScroll: false, handleScale: false,
};
const chart = createYieldCurveChart(document.getElementById('container'), chartOptions);
// ... adding series and data


Options Chart (Price-based)

The options chart is a specialized type that uses price values on the horizontal scale instead of time.

Creation method: createOptionsChart

Horizontal scale: Price-based (numeric)

Use case: Visualizing option chains, price distributions, or any data where price is the primary x-axis metric

import { createOptionsChart } from 'lightweight-charts';
const chart = createOptionsChart(document.getElementById('container'), options);


This chart type is particularly useful for financial instruments like options, where the price is a more relevant x-axis metric than time.

const chartOptions = {
    layout: { textColor: 'black', background: { type: 'solid', color: 'white' } },
};
const chart = createOptionsChart(document.getElementById('container'), chartOptions);
// ... adding series and data


Custom Horizontal Scale Chart

For advanced use cases, Lightweight Charts allows creating charts with custom horizontal scale behavior.

Creation method: createChartEx

Horizontal scale: Custom-defined

Use case: Specialized charting needs with non-standard horizontal scales

import { createChartEx, defaultHorzScaleBehavior } from 'lightweight-charts';
const customBehavior = new (defaultHorzScaleBehavior())(); // Customize the behavior as needed 
const chart = createChartEx(document.getElementById('container'), customBehavior, options);


Choosing the Right Chart Type

Use createChart for most standard time-based charting needs.

Choose createYieldCurveChart when working specifically with yield curves or similar financial data.

Opt for createOptionsChart when you need to visualize data with price as the primary horizontal axis, such as option chains.

Use createChartEx when you need a custom horizontal scale behavior that differs from the standard time-based or price-based scales.

Price scale

Price Scale (or price axis) is a vertical scale that mostly maps prices to coordinates and vice versa. The rules of converting depend on a price scale mode, a height of the chart and visible part of the data.

By default, chart has 2 predefined price scales: left and right, and an unlimited number of overlay scales. Only left and right price scales could be displayed on the chart, all overlay scales are hidden. If you want to change left price scale, you need to use leftPriceScale option, to change right price scale use rightPriceScale, to change default options for an overlay price scale use overlayPriceScales option.

Alternatively, you can use IChartApi.priceScale method to get an API object of any price scale or ISeriesApi.priceScale to get an API object of series' price scale (the price scale that the series is attached to).

Creating a price scale

By default a chart has only 2 price scales: left and right. If you want to create an overlay price scale, you can simply assign priceScaleId option to a series (note that a value should be differ from left and right) and a chart will automatically create an overlay price scale with provided ID. If a price scale with such ID already exists then a series will be attached to this existing price scale. Further you can use provided price scale ID to get its corresponding API object via IChartApi.priceScale method.

Removing a price scale

The default price scales (left and right) cannot be removed, you can only hide them by setting visible option to false. An overlay price scale exists while there is at least 1 series attached to this price scale. Thus, to remove an overlay price scale remove all series attached to this price scale.

Time scale

Overview

Time scale (or time axis) is a horizontal scale that displays the time of data points at the bottom of the chart. The horizontal scale can also represent price or other custom values. Refer to the Chart types article for more information.

Time scale appearance

Use TimeScaleOptions to adjust the time scale appearance. You can specify these options in two ways:

On chart initialization. To do this, provide the desired options as a timeScale parameter when calling createChart.

On the fly using either the ITimeScaleApi.applyOptions or IChartApi.applyOptions method. Both methods produce the same result.

Time scale API

Call the IChartApi.timeScale method to get an instance of the ITimeScaleApi interface. This interface provides an extensive API for controlling the time scale. For example, you can adjust the visible range, convert a time point or index to a coordinate, and subscribe to events.

chart.timeScale().resetTimeScale();


Visible range

Visible range is a chart area that is currently visible on the canvas. This area can be measured with both data and logical range. Data range usually includes bar timestamps, while logical range has bar indices.

You can adjust the visible range using the following methods:

setVisibleRange

getVisibleRange

setVisibleLogicalRange

getVisibleLogicalRange

Data range

The data range includes only values from the first to the last bar visible on the chart. If the visible area has empty space, this part of the scale is not included in the data range. Note that you cannot extrapolate time with the setVisibleRange method. For example, the chart does not have data prior 2018-01-01 date. If you set the visible range from 2016-01-01, it will be automatically adjusted to 2018-01-01. If you want to adjust the visible range more flexible, operate with the logical range instead.

Logical range

The logical range represents a continuous line of values. These values are logical indices on the scale. The logical range starts from the first data point across all series, with negative indices before it and positive ones after. The indices can have fractional parts. The integer part represents the fully visible bar, while the fractional part indicates partial visibility. For example, the 5.2 index means that the fifth bar is fully visible, while the sixth bar is 20% visible. A half-index, such as 3.5, represents the middle of the bar.

In the library, the logical range is represented with the LogicalRange object. This object has the from and to properties, which are logical indices on the time scale. The setVisibleLogicalRange method allows you to specify the visible range beyond the bounds of the available data. This can be useful for setting a chart margin or aligning series visually.

Chart margin

Margin is the space between the chart's borders and the series. It depends on the following time scale options:

barSpacing: The default value is 6.

rightOffset: The default value is 0.

You can specify these options as described in above. Note that if a series contains only a few data points, the chart may have a large margin on the left side. In this case, you can call the fitContent method that adjust the view and fits all data within the chart.

chart.timeScale().fitContent();


If calling fitContent has no effect, it might be due to how the library displays data. The library allocates specific width for each data point to maintain consistency between different chart types. For example, for line series, the plot point is placed at the center of this allocated space, while candlestick series use most of the width for the candle body. The allocated space for each data point is proportional to the chart width. As a result, series with fewer data points may have a small margin on both sides.

You can specify the logical range with the setVisibleLogicalRange method to display the series exactly to the edges. For example, the code sample below adjusts the range by half a bar-width on both sides.

const vr = chart.timeScale().getVisibleLogicalRange();
chart.timeScale().setVisibleLogicalRange({ from: vr.from + 0.5, to: vr.to - 0.5 });


Panes

Panes are essential elements that help segregate data visually within a single chart. Panes are useful when you have a chart that needs to show more than one kind of data. For example, you might want to see a stock's price over time in one pane and its trading volume in another. This setup helps users get a fuller picture without cluttering the chart. By default, Lightweight Charts™ has a single pane, however, you can add more panes to the chart to display different series in separate areas.

Customization Options

Lightweight Charts™ offers a few customization options to tailor the appearance and behavior of panes:

Pane Separator Color: Customize the color of the pane separators to match the chart design or improve visibility.

Separator Hover Color: Enhance user interaction by changing the color of separators on mouse hover.

Resizable Panes: Opt to enable or disable the resizing of panes by the user, offering flexibility in how data is displayed.

Managing Panes

It's important to note that Lightweight Charts™ provides an API for pane management. This includes adding new panes, moving series between panes, adjusting pane height, and removing panes. The API ensures that developers have full control over the pane lifecycle and organization within their charts.

Time zones

Overview

Lightweight Charts™ does not natively support time zones. If necessary, you should handle time zone adjustments manually. The library processes all date and time values in UTC. To support time zones, adjust each bar's timestamp in your dataset based on the appropriate time zone offset. Therefore, a UTC timestamp should correspond to the local time in the target time zone.

Info:

When converting time zones, consider that adding a time zone offset could change not only the time but the date as well.

An offset may vary due to DST (Daylight Saving Time) or other regional adjustments.

If your data is measured in business days and does not include a time component, in most cases, you should not adjust it to a time zone.

Approaches

Consider the approaches below to convert time values to the required time zone.

Using pure JavaScript

function timeToTz(originalTime, timeZone) {
    const zonedDate = new Date(new Date(originalTime * 1000).toLocaleString('en-US', { timeZone }));
    return zonedDate.getTime() / 1000;
}


If you only need to support a client (local) time zone:

function timeToLocal(originalTime) {
    const d = new Date(originalTime * 1000);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()) / 1000;
}


Using the date-fns-tz library

import { utcToZonedTime } from 'date-fns-tz';
function timeToTz(originalTime, timeZone) {
    const zonedDate = utcToZonedTime(new Date(originalTime * 1000), timeZone);
    return zonedDate.getTime() / 1000;
}


Using the IANA time zone database

If you process a large dataset and approaches above do not meet your performance requirements, consider using the tzdata. This approach can significantly improve performance because you do not need to calculate the time zone offset for every data point individually.

Why are time zones not supported?

The approaches above were not implemented in Lightweight Charts™ for the following reasons:

Using pure JavaScript is slow. In our tests, processing 100,000 data points took over 20 seconds.

Using the date-fns-tz library introduces additional dependencies and is also slow. In our tests, processing 100,000 data points took 18 seconds.

Incorporating the IANA time zone database increases the bundle size by 29.9 kB, which is nearly the size of the entire Lightweight Charts™ library.

Plugins

Plugins allow you to extend the library's functionality and render custom elements, such as new series, drawing tools, indicators, and watermarks. You can create plugins of the following types:

Custom series — define new types of series.

Primitives — define custom visualizations, drawing tools, and chart annotations that can be attached to an existing series (series primitives) or chart pane (pane primitives).

Tips:

Use the create-lwc-plugin npm package to quickly scaffold a project for your custom plugin.

Explore the Plugin Examples Demo page that hosts interactive examples.

Custom series

Custom series allow you to define new types of series with custom data structures and rendering logic. Use the addCustomSeries method to add a custom series to the chart. Then, you can manage it through the same API available for built-in series.

class MyCustomSeries { 
    /* Class implementing the ICustomSeriesPaneView interface */ 
} 
// Create an instantiated custom series 
const customSeriesInstance = new MyCustomSeries();
const chart = createChart(document.getElementById('container'));
const myCustomSeries = chart.addCustomSeries(customSeriesInstance, { 
    // Options for MyCustomSeries 
    customOption: 10,
});
const data = [
    { time: 1642425322, value: 123, customValue: 456 }, 
    /* ... more data */ 
];
myCustomSeries.setData(data);


Primitives

Primitives allow you to define custom visualizations, drawing tools, and chart annotations. You can render them at different levels in the visual stack to create complex, layered compositions.

Series primitives

Series primitives are attached to a specific series and can render on the main pane, price and time scales. Use the attachPrimitive method to add a primitive to the chart and attach it to the series.

class MyCustomPrimitive { 
    /* Class implementing the ISeriesPrimitive interface */ 
} 
// Create an instantiated series primitive 
const myCustomPrimitive = new MyCustomPrimitive();
const chart = createChart(document.getElementById('container'));
const lineSeries = chart.addSeries(LineSeries);
const data = [
    { time: 1642425322, value: 123 }, 
    /* ... more data */ 
];
// Attach the primitive to the series 
lineSeries.attachPrimitive(myCustomPrimitive);


Pane primitives

Pane primitives are attached to a chart pane rather than a specific series. You can use them to create chart-wide annotations and features like watermarks. Caution: Note that pane primitives cannot render on the price or time scale. Use the attachPrimitive method to add a primitive to the chart and attach it to the pane.

class MyCustomPanePrimitive { 
    /* Class implementing the IPanePrimitive interface */ 
} 
// Create an instantiated pane primitive 
const myCustomPanePrimitive = new MyCustomPanePrimitive();
const chart = createChart(document.getElementById('container'));
// Get the main pane 
const mainPane = chart.panes()[0]; 
// Attach the primitive to the pane 
mainPane.attachPrimitive(myCustomPanePrimitive);


Series Primitives

Primitives are extensions to the series which can define views and renderers to draw on the chart using CanvasRenderingContext2D. Primitives are defined by implementing the ISeriesPrimitive interface.

Views

The primary purpose of a series primitive is to provide one, or more, views to the library which contain the state and logic required to draw on the chart panes. There are two types of views which are supported within ISeriesPrimitive which are:

IPrimitivePaneView

ISeriesPrimitiveAxisView

The library will evoke the following getter functions (if defined) to get references to the primitive's defined views:

paneViews

priceAxisPaneViews

timeAxisPaneViews

priceAxisViews

timeAxisViews

IPrimitivePaneView

The IPrimitivePaneView interface can be used to define a view which provides a renderer (implementing the IPrimitivePaneRenderer interface) for drawing on the corresponding area of the chart using the CanvasRenderingContext2D API. The view can define a zOrder to control where in the visual stack the drawing will occur. Renderers should provide a draw method which will be given a CanvasRenderingTarget2D target on which it can draw. Additionally, a renderer can optionally provide a drawBackground method.

ISeriesPrimitiveAxisView

The ISeriesPrimitiveAxisView interface can be used to define a label on the price or time axis. This interface provides several methods to define the appearance and position of the label, such as the coordinate method.

Lifecycle Methods

Your primitive can use the attached and detached lifecycle methods to manage the lifecycle of the primitive.

attached: Called when the primitive is attached to a chart. The attached method is evoked with a single argument containing properties for the chart, series, and a callback requestUpdate.

detached: Called when the primitive is detached from a chart.

Updating Views

Your primitive should update the views in the updateAllViews() method such that when the renderers are evoked, they can draw with the latest information.

Extending the Autoscale Info

The autoscaleInfo() method can be provided to extend the base autoScale information of the series. Whenever the chart needs to calculate the vertical visible range of the series within the current time range then it will evoke this method.

Pane Primitives

Pane Primitives are essentially the same as Series Primitives but are designed to draw on the pane of a chart rather than being associated with a specific series. Key Differences from Series Primitives:

Pane Primitives are attached to the chart pane rather than a specific series.

They cannot draw on the price and time scales.

They are ideal for chart-wide features that are not tied to a particular series.

Adding a Pane Primitive

const chart = createChart(document.getElementById('container'));
const pane = chart.panes()[0];  // Get the first (main) pane 
const myPanePrimitive = new MyCustomPanePrimitive();
pane.attachPrimitive(myPanePrimitive);


Implementing a Pane Primitive

To create a Pane Primitive, you should implement the IPanePrimitive interface.

It doesn't include methods for drawing on price and time scales.

The paneViews method is used to define what will be drawn on the chart pane.

class MyCustomPanePrimitive {
    paneViews() {
        return [
            {
                renderer: {
                    draw: target => { 
                        // Custom drawing logic here 
                    },
                },
            },
        ];
    } 
    // Other methods as needed... 
}


Custom Series Types

Custom series allow developers to create new types of series with their own data structures, and rendering logic. Note: These series are expected to have a uniform width for each data point. The only restriction on the data structure is that it should extend the CustomData interface.

Defining a Custom Series

A custom series should implement the ICustomSeriesPaneView interface.

Renderer (renderer): Should return a renderer which implements ICustomSeriesPaneRenderer interface. The draw method is evoked whenever the chart needs to draw the series. It receives CanvasRenderingTarget2D and PriceToCoordinateConverter.

Update (update): Called with the latest data (data and seriesOptions). The PaneRendererCustomData interface provides bars, barSpacing, and visibleRange.

Price Value Builder (priceValueBuilder): A function for interpreting the custom series data and returning an array of numbers representing the prices values for the item.

Whitespace (isWhitespace): A function used to determine which data points should be considered Whitespace.

Default Options (defaultOptions): The default options to be used for the series.

Destroy (destroy): Evoked when the series has been removed from the chart.

Canvas Rendering Target

The renderer functions used within the plugins (both Custom Series, and Drawing Primitives) are provided with a CanvasRenderingTarget2D interface on which the drawing logic should be executed. CanvasRenderingTarget2D is provided by the Fancy Canvas library.

Using CanvasRenderingTarget2D

CanvasRenderingTarget2D provides two rendering scope which you can use:

useMediaCoordinateSpace

useBitmapCoordinateSpace

Difference between Bitmap and Media:

Bitmap sizing represents the actual physical pixels on the device's screen.

Media size represents the size of a pixel according to the operating system (and browser).

Bitmap Coordinate Space Usage:

// target is an instance of CanvasRenderingTarget2D 
target.useBitmapCoordinateSpace(scope => {
    // scope is an instance of BitmapCoordinatesRenderingScope 
    // example of drawing a filled rectangle which fills the canvas 
    scope.context.beginPath();
    scope.context.rect(0, 0, scope.bitmapSize.width, scope.bitmapSize.height);
    scope.context.fillStyle = 'rgba(100, 200, 50, 0.5)';
    scope.context.fill();
});


Media Coordinate Space Usage:

// target is an instance of CanvasRenderingTarget2D 
target.useMediaCoordinateSpace(scope => {
    // scope is an instance of BitmapCoordinatesRenderingScope 
    // example of drawing a filled rectangle which fills the canvas 
    scope.context.beginPath();
    scope.context.rect(0, 0, scope.mediaSize.width, scope.mediaSize.height);
    scope.context.fillStyle = 'rgba(100, 200, 50, 0.5)';
    scope.context.fill();
});


General Tips: It is recommended that rendering functions should save and restore the canvas context before and after all the rendering logic.

function myRenderingFunction(scope) {
    const ctx = scope.context;
    // save the current state of the context to the stack 
    ctx.save();
    try {
        // example code 
        scope.context.beginPath();
        scope.context.rect(0, 0, scope.mediaSize.width, scope.mediaSize.height);
        scope.context.fillStyle = 'rgba(100, 200, 50, 0.5)';
        scope.context.fill();
    } finally {
        // restore the saved context from the stack 
        ctx.restore();
    }
}
target.useMediaCoordinateSpace(scope => {
    myRenderingFunction(scope);
    /* ... */ 
});


Best Practices for Pixel Perfect Rendering in Canvas Drawings

To achieve crisp pixel perfect rendering for your plugins, it is recommended that the canvas drawings are created using bitmap coordinates. Essentially, all drawing actions should use integer positions and dimensions when on the bitmap coordinate space.

Centered Shapes

If you need to draw a shape which is centred on a position (for example a price or x coordinate) and has a desired width then you could use the positionsLine function.

interface BitmapPositionLength {
     /** coordinate for use with a bitmap rendering scope */
     position: number;
     /** length for use with a bitmap rendering scope */
     length: number;
}
function centreOffset(lineBitmapWidth: number): number {
    return Math.floor(lineBitmapWidth * 0.5);
} 
/**
  * Calculates the bitmap position for an item with a desired length (height or width), and centred according to
  * a position coordinate defined in media sizing.
  */
export function positionsLine(
    positionMedia: number,
    pixelRatio: number,
    desiredWidthMedia: number = 1,
    widthIsBitmap?: boolean): BitmapPositionLength {
    const scaledPosition = Math.round(pixelRatio * positionMedia);
    const lineBitmapWidth = widthIsBitmap
        ? desiredWidthMedia
        : Math.round(desiredWidthMedia * pixelRatio);
    const offset = centreOffset(lineBitmapWidth);
    const position = scaledPosition - offset;
    return { position, length: lineBitmapWidth };
}


Dual Point Shapes

If you need to draw a shape between two coordinates (for example, y coordinates for a high and low price) then you can use the positionsBox function.

export function positionsBox(
    position1Media: number,
    position2Media: number,
    pixelRatio: number): BitmapPositionLength {
    const scaledPosition1 = Math.round(pixelRatio * position1Media);
    const scaledPosition2 = Math.round(pixelRatio * position2Media);
    return {
        position: Math.min(scaledPosition1, scaledPosition2),
        length: Math.abs(scaledPosition2 - scaledPosition1) + 1,
    };
}


Default Widths

Please refer to the following pages for functions defining the default widths of shapes drawn by the library.

Candlestick Width Calculations

The following functions can be used to get the calculated width that the library would use for a candlestick at a specific bar spacing and device pixel ratio.

function optimalCandlestickWidth(
    barSpacing: number,
    pixelRatio: number): number {
    const barSpacingSpecialCaseFrom = 2.5;
    const barSpacingSpecialCaseTo = 4;
    const barSpacingSpecialCaseCoeff = 3;
    if (barSpacing >= barSpacingSpecialCaseFrom && barSpacing <= barSpacingSpecialCaseTo) {
        return Math.floor(barSpacingSpecialCaseCoeff * pixelRatio);
    }
    // coeff should be 1 on small barspacing and go to 0.8 while bar spacing grows 
    const barSpacingReducingCoeff = 0.2;
    const coeff =
        1 -
        (barSpacingReducingCoeff *
            Math.atan(
                Math.max(barSpacingSpecialCaseTo, barSpacing) - barSpacingSpecialCaseTo
            )) /
            (Math.PI * 0.5);
    const res = Math.floor(barSpacing * coeff * pixelRatio);
    const scaledBarSpacing = Math.floor(barSpacing * pixelRatio);
    const optimal = Math.min(res, scaledBarSpacing);
    return Math.max(Math.floor(pixelRatio), optimal);
}

export function candlestickWidth(
    barSpacing: number,
    horizontalPixelRatio: number): number {
    let width = optimalCandlestickWidth(barSpacing, horizontalPixelRatio);
    if (width >= 2) {
        const wickWidth = Math.floor(horizontalPixelRatio);
        if (wickWidth % 2 !== width % 2) {
            width--;
        }
    }
    return width;
}


Histogram Column Width Calculations

The following functions can be used to get the calculated width that the library would use for a histogram column at a specific bar spacing and device pixel ratio.

const alignToMinimalWidthLimit = 4;
const showSpacingMinimalBarWidth = 1;

function columnSpacing(barSpacingMedia: number, horizontalPixelRatio: number) {
    return Math.ceil(barSpacingMedia * horizontalPixelRatio) <=
        showSpacingMinimalBarWidth
        ? 0
        : Math.max(1, Math.floor(horizontalPixelRatio));
}

function desiredColumnWidth(
    barSpacingMedia: number,
    horizontalPixelRatio: number,
    spacing?: number) {
    return (
        Math.round(barSpacingMedia * horizontalPixelRatio) -
        (spacing ?? columnSpacing(barSpacingMedia, horizontalPixelRatio))
    );
}

function columnCommon(
    barSpacingMedia: number,
    horizontalPixelRatio: number): ColumnCommon {
    const spacing = columnSpacing(barSpacingMedia, horizontalPixelRatio);
    const columnWidthBitmap = desiredColumnWidth(
        barSpacingMedia,
        horizontalPixelRatio,
        spacing
    );
    const shiftLeft = columnWidthBitmap % 2 === 0;
    const columnHalfWidthBitmap = (columnWidthBitmap - (shiftLeft ? 0 : 1)) / 2;
    return {
        spacing,
        shiftLeft,
        columnHalfWidthBitmap,
        horizontalPixelRatio,
    };
}

// ... Additional helper functions like calculateColumnPosition, fixPositionsAndReturnSmallestWidth, fixAlignmentForNarrowColumns ...

export function calculateColumnPositions(
    xMediaPositions: number[],
    barSpacingMedia: number,
    horizontalPixelRatio: number): ColumnPosition[] {
    const common = columnCommon(barSpacingMedia, horizontalPixelRatio);
    const positions = new Array<ColumnPosition>(xMediaPositions.length);
    let previous: ColumnPosition | undefined = undefined;
    for (let i = 0; i < xMediaPositions.length; i++) {
        positions[i] = calculateColumnPosition(
            xMediaPositions[i],
            common,
            previous
        );
        previous = positions[i];
    }
    const initialMinWidth = Math.ceil(barSpacingMedia * horizontalPixelRatio);
    const minColumnWidth = fixPositionsAndReturnSmallestWidth(
        positions,
        initialMinWidth
    );
    if (common.spacing > 0 && minColumnWidth < alignToMinimalWidthLimit) {
        return fixAlignmentForNarrowColumns(positions, minColumnWidth);
    }
    return positions;
}

export function calculateColumnPositionsInPlace(
    items: ColumnPositionItem[],
    barSpacingMedia: number,
    horizontalPixelRatio: number,
    startIndex: number,
    endIndex: number): void {
    const common = columnCommon(barSpacingMedia, horizontalPixelRatio);
    let previous: ColumnPosition | undefined = undefined;
    for (let i = startIndex; i < Math.min(endIndex, items.length); i++) {
        items[i].column = calculateColumnPosition(items[i].x, common, previous);
        previous = items[i].column;
    }
    // ... post-processing logic ...
}


Crosshair and Grid Line Width Calculations

export function gridAndCrosshairBitmapWidth(
    horizontalPixelRatio: number): number {
    return Math.max(1, Math.floor(horizontalPixelRatio));
}

export function gridAndCrosshairMediaWidth(
    horizontalPixelRatio: number): number {
    return (
        gridAndCrosshairBitmapWidth(horizontalPixelRatio) / horizontalPixelRatio
    );
}


Full Bar Width Calculations

export function fullBarWidth(
    xMedia: number,
    halfBarSpacingMedia: number,
    horizontalPixelRatio: number): BitmapPositionLength {
    const fullWidthLeftMedia = xMedia - halfBarSpacingMedia;
    const fullWidthRightMedia = xMedia + halfBarSpacingMedia;
    const fullWidthLeftBitmap = Math.round(
        fullWidthLeftMedia * horizontalPixelRatio
    );
    const fullWidthRightBitmap = Math.round(
        fullWidthRightMedia * horizontalPixelRatio
    );
    const fullWidthBitmap = fullWidthRightBitmap - fullWidthLeftBitmap;
    return {
        position: fullWidthLeftBitmap,
        length: fullWidthBitmap,
    };
}


From v4 to v5

In this document you can find the migration guide from the previous version v4 to v5.

Table of Contents

Series changes

Series Markers

Watermarks

Plugin Typings

Series changes

Overview of Changes:

Unified series creation API using single addSeries function

Better tree-shaking support

Individual series types must now be imported separately (for ESM)

Migration Steps: Replace all series creation calls with the new addSeries syntax.

Before (v4):

// Example with Line Series in v4
import { createChart } from 'lightweight-charts';
const chart = createChart(container, {});
const lineSeries = chart.addLineSeries({ color: 'red' });


After (v5):

// Example with Line Series in v5
import { createChart, LineSeries } from 'lightweight-charts';
const chart = createChart(container, {});
const lineSeries = chart.addSeries(LineSeries, { color: 'red' });


Migration Reference:

v4 Method

v5 Method

chart.addLineSeries(options)

chart.addSeries(LineSeries, options)

chart.addAreaSeries(options)

chart.addSeries(AreaSeries, options)

chart.addBarSeries(options)

chart.addSeries(BarSeries, options)

chart.addBaselineSeries(options)

chart.addSeries(BaselineSeries, options)

chart.addCandlestickSeries(options)

chart.addSeries(CandlestickSeries, options)

chart.addHistogramSeries(options)

chart.addSeries(HistogramSeries, options)

Series Markers

Overview of Changes:

Markers moved to separate primitive for optimized bundle size

New createSeriesMarkers function required

Marker management through dedicated primitive instance

Before (v4):

// Markers were directly managed through the series instance 
series.setMarkers([
    {
        time: '2019-04-09',
        position: 'aboveBar',
        color: 'black',
        shape: 'arrowDown',
    },
]);
// Getting markers 
const markers = series.markers();


After (v5):

// Import the markers primitive 
import { createSeriesMarkers } from 'lightweight-charts';
// Create a markers primitive instance 
const seriesMarkers = createSeriesMarkers(series, [
    {
        time: '2019-04-09',
        position: 'aboveBar',
        color: 'black',
        shape: 'arrowDown',
    },
]);
// Getting markers 
const markers = seriesMarkers.markers();
// Updating markers 
seriesMarkers.setMarkers([ /* new markers */ ]);
// Remove all markers 
seriesMarkers.setMarkers([]);


Watermarks

Overview of Changes:

Extraction from Core: The watermark functionality has been extracted from the core library.

Re-implementation: It's now re-implemented as a Pane Primitive (plugin).

Improved Tree-shaking.

Added an Image Watermark Primitive.

Migration Steps:

Before (v4):

const chart = createChart(container, {
    watermark: {
        text: 'Watermark Text',
        color: 'rgba(255,0,0,0.5)',
    },
});


After (v5):

import { createChart, createTextWatermark } from 'lightweight-charts';
const chart = createChart(container, options);
const firstPane = chart.panes()[0];
createTextWatermark(firstPane, {
    horzAlign: 'center',
    vertAlign: 'center',
    lines: [{
        text: 'Watermark Text',
        color: 'rgba(255,0,0,0.5)',
        fontSize: 50,
    }],
});


Changes in Options:

Multiple Lines: The plugin now supports multiple lines of text.

Text Options: Text-related options are now defined per line within the lines property.

Example: Implementing a Text Watermark:

const chart = createChart(container, options);
const mainSeries = chart.addSeries(LineSeries);
mainSeries.setData(generateData());
const firstPane = chart.panes()[0];
createTextWatermark(firstPane, {
    horzAlign: 'center',
    vertAlign: 'center',
    lines: [
        {
            text: 'Hello',
            color: 'rgba(255,0,0,0.5)',
            fontSize: 100,
            fontStyle: 'bold',
        },
        {
            text: 'This is a text watermark',
            color: 'rgba(0,0,255,0.5)',
            fontSize: 50,
            fontStyle: 'italic',
            fontFamily: 'monospace',
        },
    ],
});


Plugin Typings

Overview of Changes:
Some of the plugin types and interfaces have been renamed due to the additional of Pane Primitives.

ISeriesPrimitivePaneView → IPrimitivePaneView

ISeriesPrimitivePaneRenderer → IPrimitivePaneRenderer

SeriesPrimitivePaneViewZOrder → PrimitivePaneViewZOrder