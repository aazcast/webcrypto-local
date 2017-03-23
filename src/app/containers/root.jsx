import React, { PropTypes, Component } from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import Info from '../components/info/index';
import { Sidebar } from '../components/sidebar';
import Overlay from './overlay';
import { CertificateActions } from '../actions/state';
import { RoutingActions } from '../actions/ui';

const ContentStyled = styled.div`
  height: 100%;
`;

const InfoStyled = styled.div`
  width: calc(100% - 320px);
  height: 100%;
  display: inline-block;
  vertical-align: top;
  @media ${props => props.theme.media.mobile} {
    width: 100%;
  }
`;

class RootContainer extends Component {

  static propTypes = {
    params: PropTypes.oneOfType([
      PropTypes.object,
    ]),
    location: PropTypes.oneOfType([
      PropTypes.object,
    ]),
    dispatch: PropTypes.func,
  };

  static childContextTypes = {
    dispatch: PropTypes.func,
    windowSize: PropTypes.object,
    handleRootAction: PropTypes.func,
  };

  getChildContext() {
    return {
      dispatch: this.props.dispatch,
      windowSize: this.state.windowSize,
      handleRootAction: this.handleRootAction.bind(this),
    };
  }

  static getWindowSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    let device = 'desktop';

    if (width <= 1024 && width > 736) {
      device = 'tablet';
    } else if (width <= 736) {
      device = 'mobile';
    }

    return {
      width,
      height,
      device,
    };
  }

  constructor() {
    super();

    this.state = {
      windowSize: RootContainer.getWindowSize(),
      sidebarOpen: false,
    };

    this.bindedOnResize = ::this.onResize;

    window.addEventListener('resize', this.bindedOnResize);
  }

  componentDidMount() {
    const { dispatch, certificates, params } = this.props;
    const selectedCertificate = this.getSelectedCertificateProps();
    if (params.id) {
      dispatch(CertificateActions.select(params.id));
    } else if (!selectedCertificate.id && certificates.length) {
      dispatch(CertificateActions.select(certificates[0].id));
    }
  }

  componentDidUpdate(prevProps) {
    const { params, dispatch, certificates } = this.props;
    if (prevProps.params.id !== params.id) {
      dispatch(CertificateActions.select(params.id));
    }

    if (prevProps.certificates.length === 1 && !certificates.length) {
      dispatch(RoutingActions.push(''));
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.bindedOnResize);
  }

  onResize() {
    this.setState({
      windowSize: RootContainer.getWindowSize(),
    });
  }

  getSelectedCertificateProps() {
    const { certificates } = this.props;
    let certificate = {};

    certificates.map((cert) => {
      if (cert.selected) {
        certificate = cert;
      }
    });

    return certificate;
  }

  handleRootAction(payload) {
    const { type } = payload;

    switch (type) {
      case 'SIDEBAR:OPEN': {
        this.setState({
          sidebarOpen: true,
        });
        break;
      }

      case 'SIDEBAR:CLOSE': {
        this.setState({
          sidebarOpen: false,
        });
        break;
      }

      default:
        return true;
    }
  }

  render() {
    const { certificates, serverIsOnline } = this.props;
    const { sidebarOpen } = this.state;

    return (
      <ContentStyled>
        <Sidebar
          open={sidebarOpen}
          list={certificates}
          online={serverIsOnline}
        />
        <InfoStyled>
          <Info
            certificate={this.getSelectedCertificateProps()}
          />
        </InfoStyled>
        <Overlay {...this.props} />
      </ContentStyled>
    );
  }
}

export default connect(state => state.get(), null, null, { pure: false })(RootContainer);
