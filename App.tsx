import React, { Component } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RtcEngine, {
  ChannelProfile,
} from 'react-native-agora';

import requestCameraAndAudioPermission from './components/Permission';
import styles from './components/Style';
import GetTokenService from './service/get_token';
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
  channelNameError: string | null;
  joinSucceed: boolean;
  peerIds: number[];
  logs: string[];
  currentRole: ClientRole | null,
  isSpeaker: boolean,
  isUserAllowedToSpeak: boolean
}

// OURS app id for development
const APP_ID = '78668502cc6a4088a1793cdbe1a4ba6c';

export default class App extends Component<Props, State> {
  _engine?: RtcEngine;

  constructor(props) {
    super(props);
    this.state = {
      appId: APP_ID,
      token: '',
      channelName: '',
      channelNameError: null,
      joinSucceed: false,
      peerIds: [],
      logs: [],
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

  handleChannelNameChange = (text: string) => {
    this.setState({
      channelName: text,
      channelNameError: null
    })
  }

  addToLogs = (log: string) => {
    const current = this.state.logs;
    current.push(log);
    this.setState({
      logs: current
    })
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
      this.setState({
        channelNameError: `Error code: ${String(err)}`
      })
    });

    this._engine.addListener('UserJoined', (uid, elapsed) => {
      console.log('UserJoined', uid, elapsed);
      // Get current peer IDs
      const { peerIds } = this.state;
      this.addToLogs(`${uid} Joined the event`)
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
      this.addToLogs(`${uid} Left the event`)

      const { peerIds } = this.state;
      this.setState({
        // Remove peer ID from state array
        peerIds: peerIds.filter((id) => id !== uid),
      });
    });

    // If Local user joins RTC channel
    this._engine.addListener('JoinChannelSuccess', (channel, uid, elapsed) => {
      console.log('JoinChannelSuccess', channel, uid, elapsed);
      this.addToLogs(`${uid} joined ${channel}`)

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
    try {
      if(!this.state.channelName || this.state.channelName.length < 4) {
        throw new Error("Channel name invalid")
      }
      const token = await GetTokenService.getAccessToken(this.state.channelName);
      await this._engine?.joinChannel(
        token,
        this.state.channelName,
        null,
        0
      );
      await this._engine?.setChannelProfile(ChannelProfile.LiveBroadcasting);
      await this._engine?.setEnableSpeakerphone(true);

    } catch (error) {
      this.setState({
        channelNameError: error.message
      })
    }
  };

  joinEventAsUser = async () => {
    await this.startCall();
    await this._engine?.setClientRole(ClientRole.Audience);
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
    // await this._engine?.disableAudio();
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
      <>
        <TextInput
          value={this.state.channelName}
          onChangeText={this.handleChannelNameChange}
          placeholder={'Channel'}
          style={styles.channelInput}
        ></TextInput>
        <Text>{this.state.channelNameError}</Text>
        <View style={styles.buttonHolder}>
          <TouchableOpacity
            onPress={this.joinEventAsCollaborator}
            style={styles.button}
          >
            <Text style={styles.buttonText}> Join as Collaborator </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={this.joinEventAsUser}
            style={styles.button}
          >
            <Text style={styles.buttonText}> Join as User </Text>
          </TouchableOpacity>
        </View>
      </>
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
          {/* <TouchableOpacity onPress={this.toggleSpeaker} style={styles.button}>
            <Text style={styles.buttonText}>
              {this.state.isSpeaker ? 'Earpiece' : 'Speaker'}
            </Text>
          </TouchableOpacity> */}
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
    const { logs } = this.state;
    return (
      <View style={styles.logsContainer}>
        {logs.map((value, index) => {
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
