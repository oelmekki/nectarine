import { h, Component } from 'preact';
import { Card, Button, Icon } from 'preact-mdl';
import { Link } from 'preact-router';
import { bind, memoize, debounce } from 'decko';
import Post from './post';
import LoadingScreen from './loading-screen';
import peach from '../peach';
import { emit, on, off } from '../pubsub';

const EMPTY = {};

export class Connections extends Component {
	counter = 0;
	explore = false;
	state = { loading: true };

	componentDidMount() {
		if (!this.lastUpdate || (Date.now()-this.lastUpdate)>30000) {
			this.update();
		}
		else if (!this.explore && peach.store.getState().connections) {
			this.update();
		}
		on('refresh', this.forceUpdate);
	}

	componentWillUnmount() {
		off('refresh', this.forceUpdate);
	}

	@bind
	forceUpdate() {
		this.update({ force:true });
	}

	@bind
	update({ force=false }=EMPTY) {
		let id = ++this.counter,
			{ connections } = peach.store.getState();
		this.lastUpdate = Date.now();

		if (!this.explore && !force && connections && connections.length) {
			// seed the cache
			connections.forEach(peach.cacheStream);
			this.setState({ loading:false, connections });
			return;
		}

		this.setState({ loading: true });

		let fn = this.explore ? peach.connections.explore : peach.connections;
		fn( (error, { connections }) => {
			if (id!==this.counter) return;

			// seed the cache
			if (connections) connections.forEach(peach.cacheStream);

			this.setState({ loading:false, error, connections });
		});
	}

	@memoize
	linkTo(url) {
		return () => emit('go', { url });
	}

	@debounce
	handleScroll() {
		emit('update-visibility');
	}

	componentDidUpdate() {
		emit('update-visibility');
	}

	render({}, { loading, error, connections=[] }) {
		if (!connections.length && !loading) return (
			<div class="explore view">
				<div class="inner">
					<div class="nothing">
						<p>Nothing to show.</p>
						<p>Let&apos;s go <Link href="/explore">Explore</Link>!</p>
					</div>
				</div>
			</div>
		);

		// filter out connections who have not posted since reading.
		connections = connections.filter( c => c.unreadPostCount!==0 );

		let { prefs } = peach.store.getState();
		if (prefs && prefs.limit && connections.length>50) {
			connections.length = 50;
		}

		return (
			<div class="explore view" onScroll={this.handleScroll}>
				<div class="inner">
					{ connections.map( connection => (
						<Connection {...connection} meta={!this.explore} onClick={this.linkTo(`/profile/${encodeURIComponent(connection.id)}`)} />
					)) }
					{ !connections.length && loading ? <LoadingScreen overlay /> : null }
				</div>
			</div>
		);
	}
}


export class ExploreConnections extends Connections {
	explore = true;
}


export class Connection extends Component {
	constructor() {
		super();
		this.read = null;
	}

	shouldComponentUpdate(props, { read }) {
		for (let i in props) if (i!=='posts' && i!=='_fetched' && props[i]!==this.props[i]) return true;
		return read!==this.read;
	}

	@bind
	onClick(e) {
		let t = e.target;
		do {
			if (String(t.nodeName).toUpperCase()==='A') {
				e.stopPropagation();
				return;
			}
		} while( (t=t.parentNode) );
		this.props.onClick(e);
	}

	@bind
	markRead(e) {
		peach.markAsRead(this.props.id);
		this.setState({ read:true });
		if (e) e.stopPropagation();
		return false;
	}

	render({ id, key, displayName, posts=[], unreadPostCount=0, avatarSrc, meta }, { read }) {
		this.read = read;
		return (
			<Card shadow={2} key={key} read={read || null} class="centered stream-connection" onClick={this.onClick}>
				<Card.Title>
					<div class="avatar" style={`background-image: url(${avatarSrc});`} />
					<Card.TitleText>{ displayName } <span class="unread-count">({ unreadPostCount || 0 })</span></Card.TitleText>
					{ meta ? (
						<div class="connection-meta">
							<Button icon onClick={this.markRead}><Icon icon="done" /></Button>
						</div>
					) : null }
				</Card.Title>
				<Card.Text>
					{ posts.length ? (
						<Post comment={false} authorId={id} {...posts[posts.length-1]} />
					) : null }
				</Card.Text>
			</Card>
		);
	}
}
