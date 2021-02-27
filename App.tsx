import React, { Component } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import RtcEngine, {
  ChannelProfile,
} from 'react-native-agora';

import requestCameraAndAudioPermission from './components/Permission';
import styles from './components/Style';

import { ClientRole } from 'react-native-agora'

interface Props {}

/**
 * @property peerIds Array for storing connected peers
 * @property appId
 * @property channelName Channel Name for the current session
 * @property joinSucceed State variable for storing success
 * @params fsa;kf
 */
interface State {
  appId: string;
  token: string;
  channelName: string;
  joinSucceed: boolean;
  peerIds: number[];
  currentRole: ClientRole | null,
  isSpeaker: boolean,
  isUserAllowedToSpeak: boolean
}

export default class App extends Component<Props, State> {
  _engine?: RtcEngine;

  constructor(props) {
    super(props);
    this.state = {
      appId: '33af1b40e3594f919bc0ad85853ea76f',
      token:
        '00633af1b40e3594f919bc0ad85853ea76fIACkBPNAFL+yxcyfXq+SlOQRXiqPbfRQM9NQQQ4Vsp9m8gJkFYoAAAAAEAAdwi3RUVI7YAEAAQBRUjtg',
      channelName: 'channel-x',
      joinSucceed: false,
      peerIds: [],
      currentRole: null,
      isSpeaker: true,
      isUserAllowedToSpeak: false,
    };
    if (Platform.OS === 'android') {
      // Request required permissions from Android
      requestCameraAndAudioPermission().then(() => {
        console.log('requested!');
      });
    }
  }

  componentDidMount() {
    this.init();
  }

  /**
   * @name init
   * @description Function to initialize the Rtc Engine, attach event listeners and actions
   */
  init = async () => {
    const { appId } = this.state;
    this._engine = await RtcEngine.create(appId);

    this._engine.addListener('Warning', (warn) => {
      console.log('Warning', warn);
    });

    this._engine.addListener('Error', (err) => {
      console.log('Error something', err);
    });

    this._engine.addListener('UserJoined', (uid, elapsed) => {
      console.log('UserJoined', uid, elapsed);
      // Get current peer IDs
      const { peerIds } = this.state;
      // If new user
      if (peerIds.indexOf(uid) === -1) {
        this.setState({
          // Add peer ID to state array
          peerIds: [...peerIds, uid],
        });
      }
    });

    this._engine.addListener('UserOffline', (uid, reason) => {
      console.log('UserOffline', uid, reason);
      const { peerIds } = this.state;
      this.setState({
        // Remove peer ID from state array
        peerIds: peerIds.filter((id) => id !== uid),
      });
    });

    // If Local user joins RTC channel
    this._engine.addListener('JoinChannelSuccess', (channel, uid, elapsed) => {
      console.log('JoinChannelSuccess', channel, uid, elapsed);
      // Set state variable to true
      this.setState({
        joinSucceed: true,
      });
    });
  };

  /**
   * @name startCall
   * @description Function to start the call
   */
  startCall = async () => {
    // Join Channel using null token and channel name
    await this._engine?.joinChannel(
      this.state.token,
      this.state.channelName,
      null,
      0
    );
    await this._engine?.setChannelProfile(ChannelProfile.LiveBroadcasting);
    await this._engine?.setEnableSpeakerphone(true);
  };

  joinEventAsUser = async () => {
    await this.startCall();
    await this._engine?.setClientRole(ClientRole.Audience);
    // await this._engine?.disableAudio();
    this.setState({
      currentRole: ClientRole.Audience,
    });
  };

  joinEventAsCollaborator = async () => {
    await this.startCall();
    await this._engine?.setClientRole(ClientRole.Broadcaster);
    await this._engine?.enableAudio();
    this.setState({
      currentRole: ClientRole.Broadcaster,
    });
  };

  askAQuestion = async () => {
    await this._engine?.setClientRole(ClientRole.Broadcaster)
    await this._engine?.enableAudio();
    this.setState({
      isUserAllowedToSpeak: true
    })
  }

  gotAnswer = async () => {
    await this._engine?.setClientRole(ClientRole.Audience)
    await this._engine?.disableAudio();
    this.setState({
      isUserAllowedToSpeak: false
    })
  }

  permissionToSpeak = async () => {
    const { isUserAllowedToSpeak } = this.state;
    if (isUserAllowedToSpeak) {
      await this.gotAnswer();
    } else {
      await this.askAQuestion();
    }
  }

  toggleSpeaker = async () => {
    const { isSpeaker } = this.state;
    await this._engine?.setEnableSpeakerphone(!isSpeaker);
    this.setState({
      isSpeaker: !isSpeaker,
    });
  };

  /**
   * @name endCall
   * @description Function to end the call
   */
  endCall = async () => {
    await this._engine?.leaveChannel();
    this.setState({ peerIds: [], joinSucceed: false });
  };

  render() {
    return (
      <View style={styles.max}>
        <View style={styles.max}>
          {this._renderJoinButtons()}
          {this._renderJoinedScreen()}
        </View>
      </View>
    );
  }

  _renderJoinButtons = () => {
    const { joinSucceed } = this.state;

    return joinSucceed ? null : (
      <View style={styles.buttonHolder}>
        <TouchableOpacity
          onPress={this.joinEventAsCollaborator}
          style={styles.button}
        >
          <Text style={styles.buttonText}> Join as Collaborator </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={this.joinEventAsUser} style={styles.button}>
          <Text style={styles.buttonText}> Join as User </Text>
        </TouchableOpacity>
      </View>
    );
  };

  _renderJoinedScreen = () => {

    const { joinSucceed } = this.state;

    return joinSucceed ? (
      <View style={styles.fullView}>
        <View style={styles.endButtonHolder}>
          <Text style={{ fontSize: 25, paddingBottom: 25 }}>
            You are Live as{' '}
            {this.state.currentRole === ClientRole.Audience
              ? 'User'
              : 'Speaker'}
          </Text>
          <TouchableOpacity onPress={this.endCall} style={styles.button}>
            <Text style={styles.buttonText}> End Event </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={this.toggleSpeaker} style={styles.button}>
            <Text style={styles.buttonText}>
              {this.state.isSpeaker ? 'Earpiece' : 'Speaker'}
            </Text>
          </TouchableOpacity>
          {this._renderPermissionToSpeak()}
        </View>
        <View
          style={{
            height: 500,
            flex: 1,
            alignItems: 'center',
            alignContent: 'center',
            justifyContent: 'center',
          }}
        >
          <ScrollView
            style={styles.remoteContainer}
            contentContainerStyle={{ paddingHorizontal: 2.5 }}
          >
            {this._viewJoiningLogs()}
          </ScrollView>
        </View>
      </View>
    ) : null;
  };

  _renderPermissionToSpeak = () => {
    const { isUserAllowedToSpeak, currentRole } = this.state;
    {
      return currentRole === ClientRole.Broadcaster ? null : (
        <TouchableOpacity onPress={this.permissionToSpeak} style={styles.button}>
          <Text style={styles.buttonText}>
            {isUserAllowedToSpeak ? 'Got the answer' : 'Ask a Question'}
          </Text>
        </TouchableOpacity>
      );
    }
  };

  _viewJoiningLogs = () => {
    const { peerIds } = this.state;
    return (
      <View style={styles.logsContainer}>
        {peerIds.map((value, index) => {
          console.log(value, 'peer');
          return (
            <View style={{ height: 50 }} key={value + index}>
              <Text>{value}</Text>
            </View>
          );
        })}
      </View>
    );
  };
}
