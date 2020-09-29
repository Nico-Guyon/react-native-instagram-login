
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import {
  StyleSheet,
  View,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native'
import qs from 'qs'
import { WebView } from "react-native-webview";

import axios from 'axios'

const patchPostMessageJsCode = `(${String(function () {
  var originalPostMessage = window.postMessage
  var patchedPostMessage = function (message, targetOrigin, transfer) {
    originalPostMessage(message, targetOrigin, transfer)
  }
  patchedPostMessage.toString = function () {
    return String(Object.hasOwnProperty).replace('hasOwnProperty', 'postMessage')
  }
  window.postMessage = patchedPostMessage;
})})();`

export default class Instagram extends Component {
  constructor(props) {
    super(props)
    this.state = {
      modalVisible: false,
      key: 1
    }
  }

  reload() {
    this.webView.reload();
  }

  hide() {
    this.webView.reload();
    const { key } = this.state;
    this.setState({ key: key + 1 , modalVisible: false });
  }

  show() {
    this.setState({ modalVisible: true })
  }

  async _onNavigationStateChange(webViewState) {
    const { url } = webViewState
    const { key } = this.state
    if (webViewState.title === 'Instagram' && webViewState.url === 'https://www.instagram.com/') {
      this.setState({ key: key + 1 })
    }
    if (url && url.startsWith(this.props.redirectUrl)) {
      const match = url.match(/(#|\?)(.*)/)
      const results = qs.parse(match[2])
      this.hide()
      if (results.access_token) {
        // Keeping this to keep it backwards compatible, but also returning raw results to account for future changes.
        this.props.onLoginSuccess(results.access_token, results)
      } else if (results.code) {

        const first_page_load = webViewState?.loading === false && webViewState?.title === '';
        if(!first_page_load)
          return;

        //Fetching to get token with appId, appSecret and code
        let { code } = results
        code = code.split('#_').join('')
        const { appId, appSecret, redirectUrl, scopes } = this.props
        let headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
        let http = axios.create({ baseURL: 'https://api.instagram.com/oauth/access_token',  headers: headers  })
        let form = new FormData();
        form.append( 'app_id', appId );
        form.append( 'app_secret', appSecret );
        form.append( 'grant_type', 'authorization_code' );
        form.append( 'redirect_uri', redirectUrl );
        form.append( 'code', code );
        let res = await http.post( '/', form ).catch( (error) => { console.log( error.response ); return false })

        if( res )
        {
          this.props.onLoginSuccess(res.data, results);
        }
        else
        {
          this.props.onLoginFailure(results)
        }


      } else {
        const first_page_load = webViewState?.loading === false && webViewState?.title === '';
        if(!first_page_load)
          return;

        this.props.onLoginFailure(results)
      }
    }
  }

  _onMessage(reactMessage) {
    try {
      const json = JSON.parse(reactMessage.nativeEvent.data)
      if (json && json.error_type) {
        this.hide()
        this.props.onLoginFailure(json)
      }
    } catch (err) { }
  }

  renderClose() {
    const { renderClose } = this.props
    if (renderClose) return renderClose()
    return (
      <Image source={require('./assets/close-button.png')} style={styles.imgClose} resizeMode="contain" />
    )
  }

  onClose() {
    const { onClose } = this.props
    if (onClose) onClose()
    this.setState({ modalVisible: false })
  }

  onHttpError(syntheticEvent) {
    const {nativeEvent} = syntheticEvent;
  }

  reset_url() {
    this.webView.reload();
  }

  renderWebview() {
    const { appId, appSecret, redirectUrl, scopes, responseType } = this.props
    const { key } = this.state

    let ig_uri = `https://api.instagram.com/oauth/authorize/?app_id=${appId}&app_secret=${appSecret}&redirect_uri=${redirectUrl}&response_type=${responseType}&scope=${scopes.join(',')}`

    return (
      <WebView
        {...this.props}
        key={key}
        style={[styles.webView, this.props.styles.webView]}
        containerStyle={{ flex: 1 }}
        source={{ uri: ig_uri }}
        startInLoadingState
        onNavigationStateChange={this._onNavigationStateChange.bind(this)}
        onError={this._onNavigationStateChange.bind(this)}
        onHttpError={this.onHttpError.bind(this)}
        onMessage={this._onMessage.bind(this)}
        ref={(webView) => { this.webView = webView }}
        injectedJavaScript={patchPostMessageJsCode}
        cacheEnabled={false}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={false}
        domStorageEnabled={false}
      />
    )
  }

  componentDidMount() {
    console.log('mounting done');
  }


  render() {
    const { modalStyle, wrapperStyle, containerStyle, closeStyle } = this.props
    const { modalVisible } = this.state;

    const height = modalVisible ? '100%' : '0%';
    const border = modalVisible ? 1 : 0;

    return (
      <View style={{position: 'absolute', width:'100%', height: height}}>
        <TouchableOpacity style={{flex: 0.1, borderBottomColor: '#FF510D', borderBottomWidth: border,}} onPress={() => this.hide()}></TouchableOpacity>
        {this.renderWebview()}
      </View>
    )
  }
}

const propTypes = {
  appId: PropTypes.string.isRequired,
  appSecret: PropTypes.string.isRequired,
  redirectUrl: PropTypes.string,
  scopes: PropTypes.array,
  onLoginSuccess: PropTypes.func,
  modalVisible: PropTypes.bool,
  onLoginFailure: PropTypes.func,
  responseType: PropTypes.string,
  containerStyle: PropTypes.object,
  wrapperStyle: PropTypes.object,
  closeStyle: PropTypes.object,
  modalStyle: PropTypes.object,
}

const defaultProps = {
  redirectUrl: 'https://google.com',
  styles: {},
  scopes: ['basic'],
  onLoginSuccess: (token) => {
    Alert.alert(
      'Alert Title',
      'Token: ' + token,
      [
        { text: 'OK' }
      ],
      { cancelable: false }
    )
  },
  onLoginFailure: (failureJson) => {
    console.debug(failureJson)
  },
  responseType: 'code',
}

Instagram.propTypes = propTypes
Instagram.defaultProps = defaultProps

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    alignSelf: 'stretch', 
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 40,
    paddingHorizontal: 10,
  },
  wrapper: {
    flex: 1,
    borderRadius: 5,
    borderWidth: 5,
    borderColor: 'rgba(0, 0, 0, 0.6)',
  },
  close: {
    position: 'absolute',
    top: 35,
    right: 5,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.4)',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15
  },
  imgClose: {
    width: 30,
    height: 30,
  }
})
