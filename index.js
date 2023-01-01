'use strict';

require('@babel/register');
require('@babel/polyfill');
require('custom-env').env(true);
require('./app');
